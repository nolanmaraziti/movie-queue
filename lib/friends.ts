// Friend requests and friendships. Server only.
import "server-only";
import { sql } from "./db";
import { cleanQueue } from "./serverQueue";
import type { Movie } from "./types";

export type FriendStatus = "none" | "friends" | "sent" | "received";
export type Person = { username: string; status: FriendStatus };

export async function statusWith(me: string, other: string): Promise<FriendStatus> {
  const rows = await sql<{ from_id: string; status: string }>(
    `SELECT from_id::text, status FROM friendships
     WHERE (from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)`,
    [me, other],
  );
  const r = rows[0];
  if (!r) return "none";
  if (r.status === "accepted") return "friends";
  return r.from_id === me ? "sent" : "received";
}

// Everyone I'm connected to in some way: friends, requests I sent, requests waiting for me.
export async function listPeople(me: string): Promise<Person[]> {
  return sql<Person>(
    `SELECT u.username,
       CASE WHEN f.status = 'accepted' THEN 'friends' WHEN f.from_id = $1 THEN 'sent' ELSE 'received' END AS status
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.from_id = $1 THEN f.to_id ELSE f.from_id END
     WHERE f.from_id = $1 OR f.to_id = $1
     ORDER BY u.username`,
    [me],
  );
}

export async function pendingCount(me: string) {
  const rows = await sql<{ n: number }>("SELECT count(*)::int AS n FROM friendships WHERE to_id = $1 AND status = 'pending'", [me]);
  return rows[0]?.n ?? 0;
}

export async function userIdFor(username: string) {
  const rows = await sql<{ id: string }>("SELECT id::text FROM users WHERE username = $1", [username]);
  return rows[0]?.id ?? null;
}

export type FriendQueue = { username: string; queue: Movie[]; since: string | null };

// All my friends with their queues. Queues that changed most recently come first.
export async function friendsWithQueues(me: string): Promise<FriendQueue[]> {
  const rows = await sql<{ username: string; queue: unknown; since: Date | null }>(
    `SELECT u.username, u.queue, COALESCE(f.accepted_at, f.created_at) AS since
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.from_id = $1 THEN f.to_id ELSE f.from_id END
     WHERE (f.from_id = $1 OR f.to_id = $1) AND f.status = 'accepted'
     ORDER BY u.queue_updated_at DESC NULLS LAST, u.username`,
    [me],
  );
  return rows.map((r) => ({ username: r.username, queue: cleanQueue(r.queue), since: r.since?.toISOString() ?? null }));
}

// For each person who sent me a request: how many friends we already share.
export async function requestsWithMutuals(me: string): Promise<{ username: string; mutual: number }[]> {
  return sql(
    `WITH mine AS (
       SELECT CASE WHEN from_id = $1 THEN to_id ELSE from_id END AS id FROM friendships
       WHERE (from_id = $1 OR to_id = $1) AND status = 'accepted'
     )
     SELECT u.username,
       (SELECT count(*)::int FROM friendships g
        WHERE g.status = 'accepted' AND (g.from_id = u.id OR g.to_id = u.id)
          AND (CASE WHEN g.from_id = u.id THEN g.to_id ELSE g.from_id END) IN (SELECT id FROM mine)) AS mutual
     FROM friendships f JOIN users u ON u.id = f.from_id
     WHERE f.to_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [me],
  );
}

// When two people became friends (null if they aren't).
export async function friendsSince(me: string, other: string): Promise<string | null> {
  const rows = await sql<{ since: Date }>(
    `SELECT COALESCE(accepted_at, created_at) AS since FROM friendships
     WHERE ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)) AND status = 'accepted'`,
    [me, other],
  );
  return rows[0]?.since.toISOString() ?? null;
}
