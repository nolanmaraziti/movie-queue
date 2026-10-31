// Talks to the Postgres database (Neon on Vercel). Server only, like tmdb.ts.
// The tables are created automatically the first time the app runs,
// so there is nothing to set up by hand inside the database.
import "server-only";
import { Pool } from "pg";

export class DbError extends Error {}

// Vercel's Neon integration adds DATABASE_URL (and POSTGRES_URL) for you.
function connectionString() {
  const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL)?.trim();
  if (!url) {
    throw new DbError("DATABASE_URL is missing. Add a Neon database in Vercel (Storage tab), or put DATABASE_URL in .env.local.");
  }
  return url;
}

// Reuse one connection pool while the server is warm (also across hot reloads in dev).
const g = globalThis as unknown as { mqPool?: Pool; mqReady?: Promise<void> };

function pool() {
  if (!g.mqPool) {
    // Neon's connection string ends in ?sslmode=require, which keeps the connection encrypted.
    g.mqPool = new Pool({ connectionString: connectionString(), max: 3 });
  }
  return g.mqPool;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    queue JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );
  -- One row per pair of people. from_id sent the request; status becomes 'accepted' when the other person says yes.
  CREATE TABLE IF NOT EXISTS friendships (
    from_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (from_id, to_id)
  );
  CREATE INDEX IF NOT EXISTS friendships_to_idx ON friendships (to_id);
  -- Stops two requests between the same two people (one each way) from both being saved.
  CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_idx ON friendships (LEAST(from_id, to_id), GREATEST(from_id, to_id));
  -- Group queues: a named queue shared by a few friends.
  CREATE TABLE IF NOT EXISTS group_queues (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    queue JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- Who's in each group. status is 'invited' until they accept, then 'joined'.
  CREATE TABLE IF NOT EXISTS group_members (
    group_id BIGINT NOT NULL REFERENCES group_queues(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('invited', 'joined')),
    invited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members (user_id);
  -- When a queue last changed (Friends lists recently changed queues first), and when a friendship began.
  ALTER TABLE users ADD COLUMN IF NOT EXISTS queue_updated_at TIMESTAMPTZ;
  ALTER TABLE friendships ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
`;

function ready() {
  g.mqReady ??= pool().query(SCHEMA).then(() => undefined).catch((err) => {
    g.mqReady = undefined; // try again on the next request
    throw err;
  });
  return g.mqReady;
}

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const res = await pool().query(text, params);
  return res.rows as T[];
}

// Runs several queries as one step. Nothing is saved unless they all work, and rows
// read with "FOR UPDATE" stay locked until the step finishes, so changes take turns.
export async function transaction<T>(run: (q: typeof sql) => Promise<T>): Promise<T> {
  await ready();
  const client = await pool().connect();
  const q = async <R = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    (await client.query(text, params)).rows as R[];
  try {
    await client.query("BEGIN");
    const result = await run(q);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
