// Movie nights: plan one, invite friends and groups, RSVP, vote on the movie, and the wall. Server only.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sql, transaction } from "./db";
import { cleanQueue } from "./serverQueue";
import type { Movie } from "./types";

export type Rsvp = "pending" | "going" | "maybe" | "no";
export type Kind = "home" | "theater";
export type PickMode = "vote" | "upnext" | "spin";

export type Night = {
  id: string;
  token: string;
  host: string;
  hostId: string;
  kind: Kind;
  title: string;
  note: string;
  startsAt: string;
  tz: string;
  place: string;
  address: string;
  groupId: string | null;
  groupName: string | null;
  pickMode: PickMode;
  options: Movie[];
  movie: Movie | null;
};

// A night in a list: the Nights tab, home, and friend profiles.
export type NightCard = {
  token: string;
  title: string;
  kind: Kind;
  startsAt: string;
  tz: string;
  place: string;
  host: string;
  groupName: string | null;
  movie: Movie | null;
  rsvp: Rsvp;
  going: string[];
  goingCount: number;
  maybeCount: number;
};

// How long after it starts a night still counts as "upcoming".
const STILL_ON = "4 hours";

// The cookie that remembers someone who answered without an account.
export const visitorCookie = (nightId: string) => `mq_night_${nightId}`;

export const cleanToken = (raw: string) => (/^[A-Za-z0-9_-]{8,32}$/.test(raw) ? raw : null);
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function cleanText(raw: unknown, max: number) {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function cleanRsvp(raw: unknown): Exclude<Rsvp, "pending"> | null {
  return raw === "going" || raw === "maybe" || raw === "no" ? raw : null;
}

type NightRow = {
  id: string; token: string; host: string; host_id: string; kind: Kind; title: string; note: string;
  starts_at: Date; tz: string; place: string; address: string; group_id: string | null; group_name: string | null;
  pick_mode: PickMode; options: unknown; movie: unknown;
};

export async function getNight(token: string): Promise<Night | null> {
  const rows = await sql<NightRow>(
    `SELECT n.id::text, n.token, u.username AS host, n.host_id::text, n.kind, n.title, n.note, n.starts_at, n.tz,
       n.place, n.address, n.group_id::text, g.name AS group_name, n.pick_mode, n.options, n.movie
     FROM nights n JOIN users u ON u.id = n.host_id LEFT JOIN group_queues g ON g.id = n.group_id
     WHERE n.token = $1`,
    [token],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id, token: r.token, host: r.host, hostId: r.host_id, kind: r.kind, title: r.title, note: r.note,
    startsAt: r.starts_at.toISOString(), tz: r.tz, place: r.place, address: r.address,
    groupId: r.group_id, groupName: r.group_name, pickMode: r.pick_mode,
    options: cleanQueue(r.options), movie: r.movie ? cleanQueue([r.movie])[0] ?? null : null,
  };
}

export type NewNight = {
  kind: Kind; title: string; note: string; startsAt: Date; tz: string; place: string; address: string;
  groupId: string | null; pickMode: PickMode; options: Movie[]; movie: Movie | null; invite: string[];
};

// Saves a night with the host as "going" and everyone invited as "pending". Returns its link token.
export async function createNight(hostId: string, n: NewNight) {
  const token = randomBytes(9).toString("base64url");
  await transaction(async (q) => {
    const rows = await q<{ id: string }>(
      `INSERT INTO nights (token, host_id, kind, title, note, starts_at, tz, place, address, group_id, pick_mode, options, movie)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id::text`,
      [token, hostId, n.kind, n.title, n.note, n.startsAt, n.tz, n.place, n.address, n.groupId, n.pickMode,
        JSON.stringify(n.options), n.movie ? JSON.stringify(n.movie) : null],
    );
    const id = rows[0].id;
    await q("INSERT INTO night_guests (night_id, user_id, rsvp) VALUES ($1, $2, 'going')", [id, hostId]);
    const others = n.invite.filter((u) => u !== hostId);
    if (others.length) {
      await q(
        `INSERT INTO night_guests (night_id, user_id) SELECT $1, unnest($2::bigint[]) ON CONFLICT DO NOTHING`,
        [id, others],
      );
    }
  });
  return token;
}

export async function deleteNight(id: string) {
  await sql("DELETE FROM nights WHERE id = $1", [id]);
}

export type Guest = { username: string; rsvp: Rsvp; vote: string | null };

export async function guests(nightId: string): Promise<Guest[]> {
  return sql<Guest>(
    `SELECT u.username, ng.rsvp, ng.vote FROM night_guests ng JOIN users u ON u.id = ng.user_id
     WHERE ng.night_id = $1
     ORDER BY CASE ng.rsvp WHEN 'going' THEN 0 WHEN 'maybe' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END, ng.created_at`,
    [nightId],
  );
}

export type Visitor = { id: string; name: string; phone: string; rsvp: Exclude<Rsvp, "pending"> };

export async function visitors(nightId: string): Promise<Visitor[]> {
  return sql<Visitor>(
    "SELECT id::text, name, phone, rsvp FROM night_visitors WHERE night_id = $1 ORDER BY created_at",
    [nightId],
  );
}

// Answering the invite. Opening the link while signed in and answering adds you to the guest list.
export async function setRsvp(nightId: string, userId: string, rsvp: Exclude<Rsvp, "pending">) {
  await sql(
    `INSERT INTO night_guests (night_id, user_id, rsvp) VALUES ($1, $2, $3)
     ON CONFLICT (night_id, user_id) DO UPDATE SET rsvp = EXCLUDED.rsvp`,
    [nightId, userId, rsvp],
  );
}

export async function setVote(nightId: string, userId: string, movieId: string | null) {
  await sql("UPDATE night_guests SET vote = $3 WHERE night_id = $1 AND user_id = $2", [nightId, userId, movieId]);
}

export async function pickMovie(nightId: string, movie: Movie | null) {
  await sql("UPDATE nights SET movie = $2 WHERE id = $1", [nightId, movie ? JSON.stringify(movie) : null]);
}

// Someone answering without an account. Returns the secret to keep in their cookie.
export async function addVisitor(nightId: string, name: string, phone: string, rsvp: Exclude<Rsvp, "pending">) {
  const secret = randomBytes(24).toString("base64url");
  const rows = await sql<{ id: string }>(
    "INSERT INTO night_visitors (night_id, secret_hash, name, phone, rsvp) VALUES ($1, $2, $3, $4, $5) RETURNING id::text",
    [nightId, sha256(secret), name, phone, rsvp],
  );
  return `${rows[0].id}.${secret}`;
}

// The visitor that a cookie belongs to, if it matches this night.
export async function findVisitor(nightId: string, cookie: string | undefined): Promise<Visitor | null> {
  const [id, secret] = (cookie ?? "").split(".");
  if (!/^\d{1,18}$/.test(id ?? "") || !secret) return null;
  const rows = await sql<Visitor>(
    "SELECT id::text, name, phone, rsvp FROM night_visitors WHERE id = $1 AND night_id = $2 AND secret_hash = $3",
    [id, nightId, sha256(secret)],
  );
  return rows[0] ?? null;
}

export async function updateVisitor(id: string, rsvp: Exclude<Rsvp, "pending">) {
  await sql("UPDATE night_visitors SET rsvp = $2 WHERE id = $1", [id, rsvp]);
}

export type Post = { id: string; username: string; body: string; at: string };

export async function posts(nightId: string): Promise<Post[]> {
  const rows = await sql<{ id: string; username: string; body: string; at: Date }>(
    `SELECT p.id::text, u.username, p.body, p.created_at AS at FROM night_posts p JOIN users u ON u.id = p.user_id
     WHERE p.night_id = $1 ORDER BY p.created_at LIMIT 200`,
    [nightId],
  );
  return rows.map((r) => ({ ...r, at: r.at.toISOString() }));
}

export async function addPost(nightId: string, userId: string, body: string) {
  await sql("INSERT INTO night_posts (night_id, user_id, body) VALUES ($1, $2, $3)", [nightId, userId, body]);
}

type CardRow = {
  token: string; title: string; kind: Kind; starts_at: Date; tz: string; place: string; host: string;
  group_name: string | null; movie: unknown; rsvp: Rsvp; going: string[]; going_count: number; maybe_count: number;
};

const CARD_SELECT = `
  SELECT n.token, n.title, n.kind, n.starts_at, n.tz, n.place, h.username AS host, g.name AS group_name, n.movie, me.rsvp,
    ARRAY(SELECT u.username FROM night_guests x JOIN users u ON u.id = x.user_id
          WHERE x.night_id = n.id AND x.rsvp = 'going' ORDER BY x.created_at LIMIT 5) AS going,
    (SELECT count(*)::int FROM night_guests x WHERE x.night_id = n.id AND x.rsvp = 'going')
      + (SELECT count(*)::int FROM night_visitors v WHERE v.night_id = n.id AND v.rsvp = 'going') AS going_count,
    (SELECT count(*)::int FROM night_guests x WHERE x.night_id = n.id AND x.rsvp = 'maybe')
      + (SELECT count(*)::int FROM night_visitors v WHERE v.night_id = n.id AND v.rsvp = 'maybe') AS maybe_count
  FROM nights n
  JOIN night_guests me ON me.night_id = n.id
  JOIN users h ON h.id = n.host_id
  LEFT JOIN group_queues g ON g.id = n.group_id`;

function toCard(r: CardRow): NightCard {
  return {
    token: r.token, title: r.title, kind: r.kind, startsAt: r.starts_at.toISOString(), tz: r.tz, place: r.place,
    host: r.host, groupName: r.group_name, movie: r.movie ? cleanQueue([r.movie])[0] ?? null : null, rsvp: r.rsvp,
    going: r.going, goingCount: r.going_count, maybeCount: r.maybe_count,
  };
}

// Every night I'm invited to or hosting, split into upcoming and past.
export async function myNights(userId: string) {
  const [upcoming, past] = await Promise.all([
    sql<CardRow>(`${CARD_SELECT} WHERE me.user_id = $1 AND n.starts_at > now() - interval '${STILL_ON}' ORDER BY n.starts_at`, [userId]),
    sql<CardRow>(
      `${CARD_SELECT} WHERE me.user_id = $1 AND me.rsvp IN ('going', 'maybe') AND n.starts_at <= now() - interval '${STILL_ON}'
       ORDER BY n.starts_at DESC LIMIT 30`,
      [userId],
    ),
  ]);
  return { upcoming: upcoming.map(toCard), past: past.map(toCard) };
}

// Upcoming nights we're both going to (or might), for a friend's profile.
export async function nightsInCommon(me: string, other: string): Promise<NightCard[]> {
  const rows = await sql<CardRow>(
    `${CARD_SELECT}
     JOIN night_guests them ON them.night_id = n.id AND them.user_id = $2 AND them.rsvp IN ('going', 'maybe')
     WHERE me.user_id = $1 AND me.rsvp IN ('going', 'maybe') AND n.starts_at > now() - interval '${STILL_ON}'
     ORDER BY n.starts_at`,
    [me, other],
  );
  return rows.map(toCard);
}

// Invites I haven't answered yet (the red number on the Nights tab).
export async function pendingNightCount(userId: string) {
  const rows = await sql<{ n: number }>(
    `SELECT count(*)::int AS n FROM night_guests ng JOIN nights n ON n.id = ng.night_id
     WHERE ng.user_id = $1 AND ng.rsvp = 'pending' AND n.starts_at > now() - interval '${STILL_ON}'`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}
