import type { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window limiter kept in memory (fine for one API process; use Redis if it ever runs on several).
 * Slows down password guessing and sign-up / reset spam.
 */
export function rateLimit({ max, windowMinutes, key }: { max: number; windowMinutes: number; key: (req: Request) => string }) {
  const buckets = new Map<string, Bucket>();
  const windowMs = windowMinutes * 60_000;

  // drop expired buckets now and then so the map doesn't grow forever
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const k = key(req);
    let b = buckets.get(k);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(k, b);
    }
    b.count++;
    if (b.count > max) {
      const minutes = Math.ceil((b.resetAt - now) / 60_000);
      res.setHeader("Retry-After", String(Math.ceil((b.resetAt - now) / 1000)));
      res.status(429).json({ error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` });
      return;
    }
    next();
  };
}

export const byIp = (req: Request) => req.ip ?? "unknown";
export const byIpAndEmail = (req: Request) => `${req.ip}|${String(req.body?.email ?? "").trim().toLowerCase()}`;
