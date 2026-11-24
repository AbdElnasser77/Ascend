import { todayISO } from "./dates";

/**
 * Talks to the API with JWT auth.
 * The access token lives only in memory; the refresh token is an httpOnly cookie the browser sends to /api/auth.
 */

export type User = { id: string; email: string; name: string | null };
type Session = { accessToken: string; user: User };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<Session | null> | null = null;
const listeners = new Set<(u: User | null) => void>();

/** Called when the session ends unexpectedly (e.g. the refresh token expired). */
export function onSessionChange(fn: (u: User | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setSession(s: Session | null) {
  accessToken = s?.accessToken ?? null;
  listeners.forEach((fn) => fn(s?.user ?? null));
}

export function hasToken() {
  return accessToken !== null;
}

async function parse(res: Response) {
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`, body?.field);
  return body;
}

async function refreshOnce(): Promise<Session | null> {
  const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
  if (res.ok) return (await res.json()) as Session;
  return null;
}

/**
 * Trade the refresh cookie for a fresh access token. Concurrent callers share one request.
 * If another tab rotated the cookie at the same moment, the first try fails, so it retries once.
 */
export function refreshSession(): Promise<Session | null> {
  refreshing ??= (async () => {
    try {
      let s = await refreshOnce();
      if (!s) {
        await new Promise((r) => setTimeout(r, 400));
        s = await refreshOnce();
      }
      if (s) accessToken = s.accessToken;
      return s;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Authenticated request. On 401 it refreshes the access token once and retries. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const send = () =>
    fetch(`/api${path}`, {
      ...init,
      credentials: "same-origin",
      headers: {
        // days are the user's local calendar days; the API validates this
        "x-local-date": todayISO(),
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });
  let res = await send();
  if (res.status === 401) {
    const s = await refreshSession();
    if (!s) {
      setSession(null);
      throw new ApiError(401, "Your session has ended. Sign in again.");
    }
    res = await send();
  }
  return parse(res);
}

async function authenticate(path: "login" | "register" | "reset", body: Record<string, string>) {
  const res = await fetch(`/api/auth/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const s = (await parse(res)) as Session;
  accessToken = s.accessToken;
  return s.user;
}

export const signIn = (email: string, password: string) => authenticate("login", { email, password });
export const signUp = (name: string, email: string, password: string) => authenticate("register", { name, email, password });

/** Ask for a reset link. Succeeds whether or not the email has an account. */
export async function requestPasswordReset(email: string) {
  await parse(
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );
}

/** Set a new password from a reset link; signs in on success. */
export const resetPassword = (token: string, password: string) => authenticate("reset", { token, password });

/** Restore the session from the refresh cookie on page load. */
export async function restoreSession(): Promise<User | null> {
  const s = await refreshSession();
  return s?.user ?? null;
}

export async function signOut() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } finally {
    setSession(null);
  }
}
