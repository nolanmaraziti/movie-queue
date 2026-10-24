// GET    /api/friends                 your friends and requests
// POST   /api/friends  { username }   send a friend request, or accept theirs
// DELETE /api/friends  { username }   unfriend, decline, or cancel a request
import { fail, readJson, signedIn } from "@/lib/api";
import { cleanUsername } from "@/lib/auth";
import { sql } from "@/lib/db";
import { listPeople, statusWith, userIdFor } from "@/lib/friends";

export function GET() {
  return signedIn(async (me) => Response.json({ people: await listPeople(me.id) }));
}

async function target(request: Request, myId: string) {
  const username = cleanUsername((await readJson(request)).username);
  const id = username ? await userIdFor(username) : null;
  return id && id !== myId ? id : null;
}

export function POST(request: Request) {
  return signedIn(async (me) => {
    const them = await target(request, me.id);
    if (!them) return fail("Couldn't find that person.", 404);

    const status = await statusWith(me.id, them);
    if (status === "received") {
      await sql("UPDATE friendships SET status = 'accepted' WHERE from_id = $1 AND to_id = $2", [them, me.id]);
    } else if (status === "none") {
      await sql(
        "INSERT INTO friendships (from_id, to_id, status) VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING",
        [me.id, them],
      );
    }
    return Response.json({ status: await statusWith(me.id, them) });
  });
}

export function DELETE(request: Request) {
  return signedIn(async (me) => {
    const them = await target(request, me.id);
    if (!them) return fail("Couldn't find that person.", 404);
    await sql(
      "DELETE FROM friendships WHERE (from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)",
      [me.id, them],
    );
    return Response.json({ status: "none" });
  });
}
