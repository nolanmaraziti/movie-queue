// GET  /api/groups/12/queue                                the group's queue right now
// POST /api/groups/12/queue  { action: "add", movie }      add a movie to the end
//                            { action: "remove", id }      take a movie off
//                            { action: "move", id, to }    move a movie to spot "to" (0 is up next)
// Everyone in the group can do all of these. Each change is applied to the newest saved
// queue, so two people changing it at once don't undo each other.
import { fail, readJson, signedIn } from "@/lib/api";
import { changeGroupQueue, cleanGroupId, getGroup, membership, type QueueChange } from "@/lib/groups";
import { cleanQueue } from "@/lib/serverQueue";

type Ctx = { params: Promise<{ id: string }> };

async function memberGroup(params: Ctx["params"], myId: string) {
  const id = cleanGroupId((await params).id);
  return id && (await membership(id, myId)) === "joined" ? id : null;
}

export function GET(_request: Request, { params }: Ctx) {
  return signedIn(async (me) => {
    const id = await memberGroup(params, me.id);
    const group = id ? await getGroup(id) : null;
    if (!group) return fail("You're not in that group.", 403);
    return Response.json({ queue: group.queue });
  });
}

export function POST(request: Request, { params }: Ctx) {
  return signedIn(async (me) => {
    const id = await memberGroup(params, me.id);
    if (!id) return fail("You're not in that group.", 403);

    const body = await readJson(request);
    const movieId = typeof body.id === "string" ? body.id : "";
    let change: QueueChange;
    if (body.action === "add") {
      const [movie] = cleanQueue([body.movie]);
      if (!movie) return fail("That movie couldn't be added.");
      change = { action: "add", movie: { ...movie, addedBy: me.username } };
    } else if (body.action === "remove" && movieId) {
      change = { action: "remove", id: movieId };
    } else if (body.action === "move" && movieId && Number.isInteger(body.to)) {
      change = { action: "move", id: movieId, to: body.to as number };
    } else {
      return fail("Unknown change.");
    }

    const { queue, error } = await changeGroupQueue(id, change);
    return error ? Response.json({ queue, error }, { status: 409 }) : Response.json({ queue });
  });
}
