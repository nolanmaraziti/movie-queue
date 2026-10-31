// PUT /api/profile/picture   { pic }   saves your profile picture
// DELETE /api/profile/picture          goes back to the letter
import { cleanPic } from "@/lib/avatar";
import { setPic } from "@/lib/avatars";
import { fail, readJson, signedIn } from "@/lib/api";

export async function PUT(request: Request) {
  return signedIn(async (me) => {
    const pic = cleanPic((await readJson(request)).pic);
    if (!pic) return fail("Pick a poster and a shape first.");
    await setPic(me.id, pic);
    return Response.json({ pic });
  });
}

export async function DELETE() {
  return signedIn(async (me) => {
    await setPic(me.id, null);
    return Response.json({ pic: null });
  });
}
