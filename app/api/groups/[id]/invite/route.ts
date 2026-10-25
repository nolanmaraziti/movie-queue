// POST   /api/groups/12/invite  { username }   invite one of your friends to the group
// DELETE /api/groups/12/invite  { username }   take back an invite they haven't answered
import { fail, readJson, signedIn } from "@/lib/api";
import { cleanUsername } from "@/lib/auth";
import { sql } from "@/lib/db";
import { statusWith, userIdFor } from "@/lib/friends";
import { cleanGroupId, membership } from "@/lib/groups";

type Ctx = { params: Promise<{ id: string }> };

// Only people in the group can invite, and only their own friends.
async function check(request: Request, params: Ctx["params"], myId: string) {
  const id = cleanGroupId((await params).id);
  if (!id || (await membership(id, myId)) !== "joined") return { error: fail("You're not in that group.", 403) };
  const username = cleanUsername((await readJson(request)).username);
  const them = username ? await userIdFor(username) : null;
  if (!them || them === myId) return { error: fail("Couldn't find that person.", 404) };
  return { id, them };
}

export function POST(request: Request, { params }: Ctx) {
  return signedIn(async (me) => {
    const c = await check(request, params, me.id);
    if (c.error) return c.error;
    if ((await statusWith(me.id, c.them)) !== "friends") return fail("You can only invite your friends.", 403);
    await sql(
      "INSERT INTO group_members (group_id, user_id, status, invited_by) VALUES ($1, $2, 'invited', $3) ON CONFLICT DO NOTHING",
      [c.id, c.them, me.id],
    );
    return Response.json({ status: await membership(c.id, c.them) });
  });
}

export function DELETE(request: Request, { params }: Ctx) {
  return signedIn(async (me) => {
    const c = await check(request, params, me.id);
    if (c.error) return c.error;
    await sql("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = 'invited'", [c.id, c.them]);
    return Response.json({ status: await membership(c.id, c.them) });
  });
}
