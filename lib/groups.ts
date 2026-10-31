// Group queues: a named queue that a few friends add to together. Server only.
import "server-only";
import { sql, transaction } from "./db";
import { MAX } from "./queue";
import { cleanQueue } from "./serverQueue";
import type { Movie } from "./types";

export type GroupSummary = { id: string; name: string; members: string[]; queue: Movie[] };
export type Invite = { id: string; name: string; invitedBy: string | null; members: string[] };
export type Member = { username: string; status: "invited" | "joined" };

// Group names: 1 to 40 characters, with extra spaces squeezed out.
export function cleanGroupName(raw: unknown) {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  return name && name.length <= 40 ? name : null;
}

export const cleanGroupId = (raw: string) => (/^\d{1,18}$/.test(raw) ? raw : null);

// Is this person in the group? "joined", "invited", or null if neither.
export async function membership(groupId: string, userId: string) {
  const rows = await sql<{ status: "invited" | "joined" }>(
    "SELECT status FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId],
  );
  return rows[0]?.status ?? null;
}

export async function createGroup(name: string, userId: string) {
  const rows = await sql<{ id: string }>("INSERT INTO group_queues (name) VALUES ($1) RETURNING id::text", [name]);
  const id = rows[0].id;
  await sql("INSERT INTO group_members (group_id, user_id, status) VALUES ($1, $2, 'joined')", [id, userId]);
  return id;
}

// The groups I've joined, newest first, with who's in them and their queues.
export async function myGroups(userId: string): Promise<GroupSummary[]> {
  const rows = await sql<{ id: string; name: string; queue: unknown; members: string[] }>(
    `SELECT g.id::text, g.name, g.queue,
       ARRAY(SELECT u.username FROM group_members gm JOIN users u ON u.id = gm.user_id
             WHERE gm.group_id = g.id AND gm.status = 'joined' ORDER BY gm.created_at) AS members
     FROM group_queues g JOIN group_members me ON me.group_id = g.id
     WHERE me.user_id = $1 AND me.status = 'joined'
     ORDER BY g.created_at DESC`,
    [userId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, members: r.members, queue: cleanQueue(r.queue) }));
}

// Groups we've both joined, for a friend's profile.
export async function groupsInCommon(me: string, other: string): Promise<GroupSummary[]> {
  const rows = await sql<{ id: string }>(
    `SELECT a.group_id::text AS id FROM group_members a JOIN group_members b ON b.group_id = a.group_id
     WHERE a.user_id = $1 AND b.user_id = $2 AND a.status = 'joined' AND b.status = 'joined'`,
    [me, other],
  );
  const ids = new Set(rows.map((r) => r.id));
  return ids.size ? (await myGroups(me)).filter((g) => ids.has(g.id)) : [];
}

// Groups I've been invited to but haven't answered yet.
export async function myInvites(userId: string): Promise<Invite[]> {
  return sql<Invite>(
    `SELECT g.id::text, g.name, inv.username AS "invitedBy",
       ARRAY(SELECT u.username FROM group_members gm JOIN users u ON u.id = gm.user_id
             WHERE gm.group_id = g.id AND gm.status = 'joined' ORDER BY gm.created_at) AS members
     FROM group_members me JOIN group_queues g ON g.id = me.group_id
     LEFT JOIN users inv ON inv.id = me.invited_by
     WHERE me.user_id = $1 AND me.status = 'invited'
     ORDER BY me.created_at DESC`,
    [userId],
  );
}

export async function inviteCount(userId: string) {
  const rows = await sql<{ n: number }>(
    "SELECT count(*)::int AS n FROM group_members WHERE user_id = $1 AND status = 'invited'",
    [userId],
  );
  return rows[0]?.n ?? 0;
}

export async function getGroup(groupId: string) {
  const rows = await sql<{ name: string; queue: unknown }>("SELECT name, queue FROM group_queues WHERE id = $1", [groupId]);
  const r = rows[0];
  return r ? { name: r.name, queue: cleanQueue(r.queue) } : null;
}

export async function members(groupId: string): Promise<Member[]> {
  return sql<Member>(
    `SELECT u.username, gm.status FROM group_members gm JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1 ORDER BY gm.status DESC, gm.created_at`,
    [groupId],
  );
}

// Leaving (or declining). When the last member leaves, the group and its open invites go away.
export async function leaveGroup(groupId: string, userId: string) {
  await sql("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", [groupId, userId]);
  await sql(
    `DELETE FROM group_queues g WHERE g.id = $1
     AND NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = g.id AND status = 'joined')`,
    [groupId],
  );
}

export type QueueChange =
  | { action: "add"; movie: Movie }
  | { action: "remove"; id: string }
  | { action: "move"; id: string; to: number };

// Applies one change to the newest saved queue. The group's row is locked while we do it,
// so if two people change the queue at the same moment, the second waits for the first.
export async function changeGroupQueue(groupId: string, change: QueueChange): Promise<{ queue: Movie[]; error?: string }> {
  return transaction(async (q) => {
    const rows = await q<{ queue: unknown }>("SELECT queue FROM group_queues WHERE id = $1 FOR UPDATE", [groupId]);
    if (!rows[0]) return { queue: [], error: "That group doesn't exist anymore." };
    const queue = cleanQueue(rows[0].queue);
    let next = queue;

    if (change.action === "add") {
      if (queue.some((m) => m.id === change.movie.id)) return { queue, error: "That movie is already in the queue." };
      if (queue.length >= MAX) return { queue, error: "Queue is full" };
      next = [...queue, change.movie];
    } else if (change.action === "remove") {
      next = queue.filter((m) => m.id !== change.id);
    } else {
      const from = queue.findIndex((m) => m.id === change.id);
      if (from < 0) return { queue };
      next = [...queue];
      const [m] = next.splice(from, 1);
      next.splice(Math.max(0, Math.min(next.length, change.to)), 0, m);
    }

    await q("UPDATE group_queues SET queue = $2 WHERE id = $1", [groupId, JSON.stringify(next)]);
    return { queue: next };
  });
}
