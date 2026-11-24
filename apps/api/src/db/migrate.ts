import { pool } from "./pool.js";

/**
 * Schema, applied in order. Each entry runs once; applied ids are recorded in schema_migrations.
 * Never edit an applied migration — add a new one.
 */
const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_users_auth_state",
    sql: `
      CREATE TABLE users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email         text NOT NULL,
        name          text,
        password_hash text NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX users_email_key ON users (lower(email));

      -- one row per issued refresh token; only the SHA-256 of the token id is stored
      CREATE TABLE refresh_tokens (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  text NOT NULL UNIQUE,
        expires_at  timestamptz NOT NULL,
        revoked_at  timestamptz,
        created_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

      -- the journey (habits, goals, tasks, log…) as the web app stores it, per user
      CREATE TABLE user_state (
        user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data       jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    // The journey moves from one JSON blob to real tables. Dates are the user's local calendar days.
    id: "002_journey_tables",
    sql: `
      DROP TABLE user_state;

      ALTER TABLE users
        ADD COLUMN birthday      date,
        ADD COLUMN journey_start date,
        ADD COLUMN start_slots   smallint CHECK (start_slots BETWEEN 0 AND 2);

      CREATE TABLE habits (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
        icon        text NOT NULL,
        created_on  date NOT NULL,
        archived_on date CHECK (archived_on > created_on),
        created_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX habits_user_idx ON habits (user_id);

      -- a habit checked off on a day
      CREATE TABLE habit_checks (
        habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day      date NOT NULL,
        PRIMARY KEY (habit_id, day)
      );
      CREATE INDEX habit_checks_user_idx ON habit_checks (user_id, day);

      -- Second Chance: a missed day repaired later
      CREATE TABLE habit_redeems (
        habit_id    uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day         date NOT NULL,
        redeemed_on date NOT NULL CHECK (redeemed_on > day),
        PRIMARY KEY (habit_id, day)
      );
      CREATE INDEX habit_redeems_user_idx ON habit_redeems (user_id);

      CREATE TABLE tasks (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title      text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
        day        date NOT NULL,
        done       boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX tasks_user_day_idx ON tasks (user_id, day);

      CREATE TABLE goals (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
        kind        text CHECK (kind IN ('course', 'streak', 'position', 'milestone')),
        main        boolean NOT NULL DEFAULT false,
        created_on  date NOT NULL,
        achieved_on date,
        created_at  timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX goals_user_idx ON goals (user_id);
      -- at most one unfinished main goal per user
      CREATE UNIQUE INDEX goals_one_open_main ON goals (user_id) WHERE main AND achieved_on IS NULL;
    `,
  },
  {
    // now() is fixed for a whole transaction; clock_timestamp() keeps rows saved together in the order they were added
    id: "003_row_order",
    sql: `
      ALTER TABLE habits ALTER COLUMN created_at SET DEFAULT clock_timestamp();
      ALTER TABLE tasks  ALTER COLUMN created_at SET DEFAULT clock_timestamp();
      ALTER TABLE goals  ALTER COLUMN created_at SET DEFAULT clock_timestamp();
    `,
  },
  {
    id: "004_future_you_and_password_resets",
    sql: `
      -- "Future you": who the user wants to become, and in how many years
      ALTER TABLE users
        ADD COLUMN future_self   text CHECK (length(future_self) BETWEEN 1 AND 160),
        ADD COLUMN future_years  smallint CHECK (future_years BETWEEN 1 AND 30),
        ADD COLUMN future_traits text[] NOT NULL DEFAULT '{}' CHECK (cardinality(future_traits) <= 3);

      -- one-time "forgot password" links; only the SHA-256 of the token is stored
      CREATE TABLE password_resets (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        used_at    timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX password_resets_user_idx ON password_resets (user_id);
    `,
  },
];

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const { rows } = await client.query<{ id: string }>("SELECT id FROM schema_migrations");
    const done = new Set(rows.map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await client.query("BEGIN");
      try {
        await client.query(m.sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [m.id]);
        await client.query("COMMIT");
        console.log(`Applied migration ${m.id}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    client.release();
  }
}
