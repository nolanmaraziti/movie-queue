// POST /api/nights  { kind, title, note, startsAt, tz, place, address, groupId, pickMode, friends, groups }
// Plans a movie night and invites friends and whole groups. Answers with the night's link token.
import { fail, readJson, signedIn } from "@/lib/api";
import { cleanUsername } from "@/lib/auth";
import { sql } from "@/lib/db";
import { cleanGroupId, getGroup, membership } from "@/lib/groups";
import { cleanText, createNight, type Kind, type PickMode } from "@/lib/nights";
import { getQueue } from "@/lib/serverQueue";
import { validTimeZone } from "@/lib/when";

const list = (raw: unknown) => (Array.isArray(raw) ? raw.slice(0, 100) : []);

export function POST(request: Request) {
  return signedIn(async (me) => {
    const b = await readJson(request);
    const kind: Kind = b.kind === "theater" ? "theater" : "home";
    const pickMode: PickMode = b.pickMode === "upnext" || b.pickMode === "spin" ? b.pickMode : "vote";
    const title = cleanText(b.title, 80);
    if (!title) return fail("Give your night a name.");
    const startsAt = new Date(typeof b.startsAt === "string" ? b.startsAt : "");
    if (Number.isNaN(startsAt.getTime())) return fail("Pick a date and time.");
    if (startsAt.getTime() < Date.now() - 60 * 60e3) return fail("That time has already passed.");
    if (startsAt.getTime() > Date.now() + 730 * 864e5) return fail("Pick a date within the next two years.");

    // Where the movies come from: a group's queue you're in, or your own queue.
    let groupId = typeof b.groupId === "string" ? cleanGroupId(b.groupId) : null;
    if (groupId && (await membership(groupId, me.id)) !== "joined") groupId = null;
    const source = groupId ? (await getGroup(groupId))?.queue ?? [] : await getQueue(me.id);
    if (pickMode !== "spin" && source.length === 0) {
      return fail(groupId ? "That group's queue is empty. Add a movie to it first." : "Your queue is empty. Add a movie first.");
    }

    // Who to invite: friends by username, plus everyone who has joined the chosen groups.
    const friendNames = list(b.friends).map(cleanUsername).filter((u): u is string => !!u);
    const groupIds = list(b.groups).map((g) => (typeof g === "string" ? cleanGroupId(g) : null)).filter((g): g is string => !!g);
    const invite = await sql<{ id: string }>(
      `SELECT u.id::text FROM users u
       JOIN friendships f ON ((f.from_id = $1 AND f.to_id = u.id) OR (f.to_id = $1 AND f.from_id = u.id)) AND f.status = 'accepted'
       WHERE u.username = ANY($2::text[])
       UNION
       SELECT gm.user_id::text FROM group_members gm
       WHERE gm.group_id = ANY($3::bigint[]) AND gm.status = 'joined'
         AND EXISTS (SELECT 1 FROM group_members mine WHERE mine.group_id = gm.group_id AND mine.user_id = $1 AND mine.status = 'joined')`,
      [me.id, friendNames, groupIds],
    );

    const token = await createNight(me.id, {
      kind,
      title,
      note: cleanText(b.note, 280),
      startsAt,
      tz: validTimeZone(b.tz) ?? "UTC",
      place: cleanText(b.place, 100),
      address: cleanText(b.address, 200),
      groupId,
      pickMode,
      options: pickMode === "vote" ? source.slice(0, 3) : [],
      movie: pickMode === "upnext" ? source[0] : null,
      invite: invite.map((r) => r.id),
    });
    return Response.json({ token });
  });
}
