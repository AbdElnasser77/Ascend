import { createHash, randomBytes } from "node:crypto";
import { isValidEmail, passwordProblem } from "@ascend/shared";
import bcrypt from "bcryptjs";
import { Router, type Response } from "express";
import { byIp, byIpAndEmail, rateLimit } from "../auth/rateLimit.js";
import { requireAuth } from "../auth/requireAuth.js";
import {
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  consumeRefreshToken,
  issueRefreshToken,
  revokeAllSessions,
  revokeRefreshToken,
  signAccessToken,
} from "../auth/tokens.js";
import { pool, tx } from "../db/pool.js";
import { env } from "../env.js";
import { HttpError } from "../http.js";
import { sendMail } from "../mail.js";

type UserRow = { id: string; email: string; name: string | null; password_hash: string };
const publicUser = (u: Pick<UserRow, "id" | "email" | "name">) => ({ id: u.id, email: u.email, name: u.name });

const BCRYPT_COST = 12;
const RESET_TTL_MINUTES = 30;

// compared against when the email doesn't exist, so login takes the same time either way
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);

const cookieOptions = {
  httpOnly: true,
  secure: env.production,
  sameSite: "lax" as const,
  path: "/api/auth",
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const normalEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();

function checkPassword(password: string, email: string) {
  const problem = passwordProblem(password, email);
  if (problem) throw new HttpError(400, problem, "password");
}

async function startSession(res: Response, user: Pick<UserRow, "id" | "email" | "name">, status = 200) {
  const refresh = await issueRefreshToken(user.id);
  res.cookie(REFRESH_COOKIE, refresh, { ...cookieOptions, maxAge: REFRESH_TTL_SECONDS * 1000 });
  res.status(status).json({ accessToken: signAccessToken(user), expiresIn: ACCESS_TTL_SECONDS, user: publicUser(user) });
}

export const authRouter = Router();

authRouter.post("/register", rateLimit({ max: 10, windowMinutes: 60, key: byIp }), async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = normalEmail(req.body?.email);
  const password = String(req.body?.password ?? "");

  if (name.length < 1 || name.length > 80) throw new HttpError(400, "Enter your name", "name");
  if (!isValidEmail(email)) throw new HttpError(400, "Enter a valid email address", "email");
  checkPassword(password, email);

  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (lower(email)) DO NOTHING
     RETURNING id, email, name, password_hash`,
    [email, name, hash],
  );
  if (!rows[0]) throw new HttpError(409, "An account with this email already exists. Sign in instead.", "email");
  await startSession(res, rows[0], 201);
});

authRouter.post("/login", rateLimit({ max: 10, windowMinutes: 15, key: byIpAndEmail }), async (req, res) => {
  const email = normalEmail(req.body?.email);
  const password = String(req.body?.password ?? "");
  if (!email || !password) throw new HttpError(400, "Enter your email and password");
  const { rows } = await pool.query<UserRow>(`SELECT id, email, name, password_hash FROM users WHERE lower(email) = $1`, [email]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Email or password is incorrect");
  await startSession(res, user);
});

/** Swap the refresh cookie for a new access token (and a rotated refresh cookie). */
authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  const userId = token ? await consumeRefreshToken(token) : null;
  const user = userId ? (await pool.query<UserRow>(`SELECT id, email, name FROM users WHERE id = $1`, [userId])).rows[0] : null;
  if (!user) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    throw new HttpError(401, "Session expired");
  }
  await startSession(res, user);
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) await revokeRefreshToken(token);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query<UserRow>(`SELECT id, email, name FROM users WHERE id = $1`, [req.user!.sub]);
  if (!rows[0]) throw new HttpError(404, "Account not found");
  res.json({ user: publicUser(rows[0]) });
});

/**
 * Email a one-time reset link. Always answers the same way, so it can't be used to find out who has an account.
 */
authRouter.post("/forgot", rateLimit({ max: 5, windowMinutes: 60, key: byIpAndEmail }), async (req, res) => {
  const email = normalEmail(req.body?.email);
  if (!isValidEmail(email)) throw new HttpError(400, "Enter a valid email address", "email");

  const { rows } = await pool.query<UserRow>(`SELECT id, email, name FROM users WHERE lower(email) = $1`, [email]);
  const user = rows[0];
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [user.id, sha256(token), RESET_TTL_MINUTES],
    );
    const link = `${env.appUrl}/#/reset?token=${token}`;
    sendMail({
      to: user.email,
      subject: "Reset your Ascend password",
      text: `Hi${user.name ? ` ${user.name}` : ""},\n\nUse this link to choose a new password. It works once and expires in ${RESET_TTL_MINUTES} minutes:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
    }).catch((err) => console.error("Reset email failed:", err));
  }
  res.json({ ok: true });
});

/** Set a new password from a reset link, sign out every other session, and sign in. */
authRouter.post("/reset", rateLimit({ max: 10, windowMinutes: 15, key: byIp }), async (req, res) => {
  const token = String(req.body?.token ?? "");
  const password = String(req.body?.password ?? "");
  const invalid = new HttpError(400, "This reset link is invalid or has expired. Ask for a new one.", "token");
  if (!token) throw invalid;

  const { rows } = await pool.query<{ user_id: string; email: string }>(
    `SELECT r.user_id, u.email FROM password_resets r JOIN users u ON u.id = r.user_id
     WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > now()`,
    [sha256(token)],
  );
  const found = rows[0];
  if (!found) throw invalid;
  checkPassword(password, found.email);

  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await tx(async (db) => {
    // using any link spends all of that user's outstanding links
    const used = await db.query(`UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [found.user_id]);
    if (!used.rowCount) throw invalid;
    const { rows: u } = await db.query<UserRow>(
      `UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING id, email, name, password_hash`,
      [found.user_id, hash],
    );
    return u[0];
  });
  await revokeAllSessions(user.id);
  await startSession(res, user);
});
