import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool.js";
import { env } from "../env.js";

/** Access tokens are short-lived and sent as `Authorization: Bearer …`; the web keeps them in memory only. */
export const ACCESS_TTL_SECONDS = 15 * 60;
/** Refresh tokens live in an httpOnly cookie and rotate on every use. */
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

export const REFRESH_COOKIE = "ascend_rt";

const ISSUER = "ascend-api";

export type AccessClaims = { sub: string; email: string };

export function signAccessToken(user: { id: string; email: string }) {
  return jwt.sign({ email: user.email }, env.accessSecret, {
    subject: user.id,
    issuer: ISSUER,
    audience: "ascend-web",
    expiresIn: ACCESS_TTL_SECONDS,
    algorithm: "HS256",
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  const p = jwt.verify(token, env.accessSecret, { issuer: ISSUER, audience: "ascend-web", algorithms: ["HS256"] });
  if (typeof p === "string" || !p.sub || typeof p.email !== "string") throw new Error("Malformed token");
  return { sub: p.sub, email: p.email };
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

/** Issue a refresh token and record it, so it can be rotated and revoked. */
export async function issueRefreshToken(userId: string) {
  const jti = randomUUID();
  const token = jwt.sign({}, env.refreshSecret, {
    subject: userId,
    jwtid: jti,
    issuer: ISSUER,
    audience: "ascend-refresh",
    expiresIn: REFRESH_TTL_SECONDS,
    algorithm: "HS256",
  });
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))`,
    [userId, hash(jti), REFRESH_TTL_SECONDS],
  );
  return token;
}

/**
 * Validate a refresh token and revoke it (rotation). Returns the user id, or null if invalid.
 * If an already-revoked token is presented, it was likely stolen and replayed:
 * every session of that user is revoked.
 */
export async function consumeRefreshToken(token: string): Promise<string | null> {
  let sub: string, jti: string;
  try {
    const p = jwt.verify(token, env.refreshSecret, { issuer: ISSUER, audience: "ascend-refresh", algorithms: ["HS256"] });
    if (typeof p === "string" || !p.sub || !p.jti) return null;
    sub = p.sub;
    jti = p.jti;
  } catch {
    return null;
  }
  const { rows } = await pool.query<{ id: string; revoked_secs_ago: number | null }>(
    `SELECT id, EXTRACT(EPOCH FROM now() - revoked_at)::float AS revoked_secs_ago
       FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2 AND expires_at > now()`,
    [hash(jti), sub],
  );
  const row = rows[0];
  if (!row) return null;

  if (row.revoked_secs_ago !== null) {
    // Two tabs refreshing at once is normal — only treat it as theft outside a short grace window.
    if (row.revoked_secs_ago > REUSE_GRACE_SECONDS) await revokeAllSessions(sub);
    return null;
  }
  // revoke-if-still-active is atomic, so a concurrent refresh can't rotate the same token twice
  const used = await pool.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [row.id]);
  return used.rowCount ? sub : null;
}

const REUSE_GRACE_SECONDS = 30;

export async function revokeAllSessions(userId: string) {
  await pool.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}

export async function revokeRefreshToken(token: string) {
  try {
    const p = jwt.verify(token, env.refreshSecret, { issuer: ISSUER, audience: "ascend-refresh", algorithms: ["HS256"] });
    if (typeof p !== "string" && p.jti) {
      await pool.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [hash(p.jti)]);
    }
  } catch {
    /* already invalid — nothing to revoke */
  }
}
