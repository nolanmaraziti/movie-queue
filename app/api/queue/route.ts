// PUT  /api/queue  { queue }   saves your whole queue, in order, every time it changes
// POST /api/queue  { movie }   adds one movie to the end (from Search or a friend's profile)
import { fail, readJson, signedIn } from "@/lib/api";
import { addToQueue, cleanQueue, setQueue } from "@/lib/serverQueue";

export function PUT(request: Request) {
  return signedIn(async (me) => {
    const queue = cleanQueue((await readJson(request)).queue);
    await setQueue(me.id, queue);
    return Response.json({ queue });
  });
}

export function POST(request: Request) {
  return signedIn(async (me) => {
    const [movie] = cleanQueue([(await readJson(request)).movie]);
    if (!movie) return fail("That movie couldn't be added.");
    delete movie.addedBy;
    const result = await addToQueue(me.id, movie);
    return Response.json(result, { status: result.error ? 409 : 200 });
  });
}
