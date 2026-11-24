import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { migrate } from "./db/migrate.js";
import { pool } from "./db/pool.js";
import { env } from "./env.js";
import { HttpError } from "./http.js";
import { authRouter } from "./routes/auth.js";
import { journeyRouter } from "./routes/journey.js";

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "ok" });
  } catch {
    res.status(503).json({ status: "degraded", db: "unreachable" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api", journeyRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Express 5 forwards rejected promises from async handlers here
app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.field && { field: err.field }) });
    return;
  }
  if (err.type === "entity.parse.failed") {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  console.error(err);
  res.status(err.status ?? 500).json({ error: "Something went wrong" });
});

await migrate();
app.listen(env.port, () => {
  console.log(`API running on http://localhost:${env.port}`);
});
