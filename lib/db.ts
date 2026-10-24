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
