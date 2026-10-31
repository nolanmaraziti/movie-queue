// POST /api/nights/abc123  { action: "rsvp", rsvp }                 answer the invite ("going", "maybe" or "no")
//                          { action: "rsvp", rsvp, name, phone }    answer without an account
//                          { action: "vote", movieId }              vote for one of the movies (null takes it back)
//                          { action: "pick", movieId }              host: lock in the movie (null reopens voting)
//                          { action: "post", body }                 write on the wall
// DELETE /api/nights/abc123                                         host: cancel the night
import { cookies } from "next/headers";
import { fail, guard, readJson } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import { getGroup } from "@/lib/groups";
import {
  addPost, addVisitor, cleanRsvp, cleanText, cleanToken, deleteNight, findVisitor, getNight, guests,
  pickMovie, setRsvp, setVote, updateVisitor, visitorCookie,
} from "@/lib/nights";
import { getQueue } from "@/lib/serverQueue";

type Ctx = { params: Promise<{ token: string }> };

async function load(params: Ctx["params"]) {
  const token = cleanToken((await params).token);
  return token ? getNight(token) : null;
}

export function POST(request: Request, { params }: Ctx) {
  return guard(async () => {
    const night = await load(params);
    if (!night) return fail("That movie night doesn't exist anymore.", 404);
    const b = await readJson(request);
    const me = await currentUser();

    if (b.action === "rsvp") {
      const rsvp = cleanRsvp(b.rsvp);
      if (!rsvp) return fail("Pick going, maybe or can't go.");
      if (me) {
        if (me.id === night.hostId) return fail("You're hosting, so you're going.");
        await setRsvp(night.id, me.id, rsvp);
        return Response.json({ ok: true });
      }
      // No account: remember them with a cookie so they can change their answer later.
      const store = await cookies();
      const name = visitorCookie(night.id);
      const existing = await findVisitor(night.id, store.get(name)?.value);
      if (existing) {
        await updateVisitor(existing.id, rsvp);
        return Response.json({ ok: true });
      }
      const who = cleanText(b.name, 40);
      if (!who) return fail("Add your name so the host knows who's coming.");
      const phone = cleanText(b.phone, 20);
      if (phone && !/^[+()\d][\d\s().-]{5,19}$/.test(phone)) return fail("That phone number doesn't look right.");
      const value = await addVisitor(night.id, who, phone, rsvp);
      store.set(name, value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires: new Date(new Date(night.startsAt).getTime() + 7 * 864e5),
      });
      return Response.json({ ok: true });
    }

    if (!me) return fail("Please log in again.", 401);
    const list = await guests(night.id);
    const isGuest = list.some((g) => g.username === me.username);
    const isHost = me.id === night.hostId;

    if (b.action === "vote") {
      if (!isGuest) return fail("Answer the invite first, then you can vote.", 403);
      if (night.pickMode !== "vote" || night.movie) return fail("Voting is closed.");
      const movieId = b.movieId === null ? null : night.options.find((m) => m.id === b.movieId)?.id;
      if (movieId === undefined) return fail("That movie isn't one of the choices.");
      await setVote(night.id, me.id, movieId);
      return Response.json({ ok: true });
    }

    if (b.action === "pick") {
      if (!isHost) return fail("Only the host can pick the movie.", 403);
      if (b.movieId === null) {
        await pickMovie(night.id, null);
        return Response.json({ ok: true });
      }
      // The host can pick one of the vote choices, or anything in the queue (the wheel).
      const source = night.groupId ? (await getGroup(night.groupId))?.queue ?? [] : await getQueue(night.hostId);
      const movie = [...night.options, ...source].find((m) => m.id === b.movieId);
      if (!movie) return fail("That movie isn't in the queue anymore.");
      await pickMovie(night.id, movie);
      return Response.json({ ok: true });
    }

    if (b.action === "post") {
      if (!isGuest) return fail("Answer the invite first, then you can write on the wall.", 403);
      const body = typeof b.body === "string" ? b.body.trim().slice(0, 500) : "";
      if (!body) return fail("Write something first.");
      await addPost(night.id, me.id, body);
      return Response.json({ ok: true });
    }

    return fail("Unknown action.");
  });
}

export function DELETE(_request: Request, { params }: Ctx) {
  return guard(async () => {
    const night = await load(params);
    if (!night) return fail("That movie night doesn't exist anymore.", 404);
    const me = await currentUser();
    if (!me || me.id !== night.hostId) return fail("Only the host can cancel the night.", 403);
    await deleteNight(night.id);
    return Response.json({ ok: true });
  });
}
