// Friend requests and friendships. Server only.
import "server-only";
import { sql } from "./db";

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
