// POST   /api/groups/12   accept an invite to the group
// DELETE /api/groups/12   decline an invite, or leave the group
import { fail, signedIn } from "@/lib/api";
import { sql } from "@/lib/db";
import { cleanGroupId, leaveGroup, membership } from "@/lib/groups";

type Ctx = { params: Promise<{ id: string }> };

export function POST(_request: Request, { params }: Ctx) {
  return signedIn(async (me) => {
    const id = cleanGroupId((await params).id);
    if (!id || !(await membership(id, me.id))) return fail("That invite isn't there anymore.", 404);
    await sql("UPDATE group_members SET status = 'joined' WHERE group_id = $1 AND user_id = $2", [id, me.id]);
    return Response.json({ status: "joined" });
  });
}

export function DELETE(_request: Request, { params }: Ctx) {
  return signedIn(async (me) => {
    const id = cleanGroupId((await params).id);
    if (id) await leaveGroup(id, me.id);
    return Response.json({ status: "none" });
  });
}
