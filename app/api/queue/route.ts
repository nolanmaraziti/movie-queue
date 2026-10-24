// PUT /api/queue  { queue }
// Saves your whole queue, in order, every time it changes.
import { readJson, signedIn } from "@/lib/api";
import { cleanQueue, setQueue } from "@/lib/serverQueue";

export function PUT(request: Request) {
  return signedIn(async (me) => {
    const queue = cleanQueue((await readJson(request)).queue);
    await setQueue(me.id, queue);
    return Response.json({ queue });
  });
}
