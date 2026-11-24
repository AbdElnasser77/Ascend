import type { Request } from "express";

/** An error whose message is safe to show the user. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** A trimmed string of the given length, or a 400. */
export function text(v: unknown, field: string, min: number, max: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length < min || s.length > max) {
    throw new HttpError(400, min > 1 ? `${field} must be ${min}–${max} characters` : `${field} can't be empty (max ${max})`, field);
  }
  return s;
}

export function date(v: unknown, field: string): string {
  if (!isDate(v)) throw new HttpError(400, `${field} must be a date (YYYY-MM-DD)`, field);
  return v;
}

/** Optional client-generated id (lets the web show changes instantly); a new one otherwise. */
export function clientId(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (!isUuid(v)) throw new HttpError(400, "id must be a UUID", "id");
  return v;
}

export function param(req: Request, name: string): string {
  const v = req.params[name];
  if (!isUuid(v)) throw new HttpError(404, "Not found");
  return v;
}

const utcDay = (offsetHours: number) => new Date(Date.now() + offsetHours * 3_600_000).toISOString().slice(0, 10);

/**
 * The user's "today". Days are local to the user, so the web sends its date in `X-Local-Date`.
 * It's only accepted if it's a real date somewhere on Earth right now (UTC-12 … UTC+14).
 */
export function localToday(req: Request): string {
  const h = req.header("x-local-date");
  if (h && isDate(h) && h >= utcDay(-12) && h <= utcDay(14)) return h;
  return utcDay(0);
}
