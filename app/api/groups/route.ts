// POST /api/groups  { name }   make a new group queue, with you as its first member
import { fail, readJson, signedIn } from "@/lib/api";
import { cleanGroupName, createGroup } from "@/lib/groups";

export function POST(request: Request) {
  return signedIn(async (me) => {
    const name = cleanGroupName((await readJson(request)).name);
    if (!name) return fail("Give the group a name (up to 40 characters).");
    return Response.json({ id: await createGroup(name, me.id) });
  });
}
