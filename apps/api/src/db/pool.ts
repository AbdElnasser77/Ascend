import pg from "pg";
import { env } from "../env.js";

// DATE columns are calendar days ("2026-11-24"); keep them as strings instead of shifting through JS Date + timezone
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

export const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 5 });

pool.on("error", (err) => console.error("Postgres pool error:", err.message));

/** Run `fn` inside a transaction. */
export async function tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
