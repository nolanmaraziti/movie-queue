// GET  /api/pick/abc123                        who's swiping, my swipes, and the matches so far
// POST /api/pick/abc123  { movieId, choice }   swipe on a movie: "like", "pass" or "seen"
import { fail, readJson, signedIn } from "@/lib/api";
import { cleanChoice, cleanPickToken, getSession, joinSession, sessionState, swipe } from "@/lib/pick";

type Ctx = { params: Promise<{ token: string }> };

async function load(params: Ctx["params"]) {
  const token = cleanPickToken((await params).token);
  return token ? getSession(token) : null;
}

export function GET(_request: Request, { params }: Ctx) {
  return signedIn(async (me) => {
    const session = await load(params);
    if (!session) return fail("That round doesn't exist anymore.", 404);
    return Response.json(await sessionState(session.id, me.id));
  });
}

export function POST(request: Request, { params }: Ctx) {
  return signedIn(async (me) => {
    const session = await load(params);
    if (!session) return fail("That round doesn't exist anymore.", 404);
    const b = await readJson(request);
    const choice = cleanChoice(b.choice);
    const movie = session.deck.find((m) => m.id === b.movieId);
    if (!choice || !movie) return fail("That movie isn't in this round.");
    await joinSession(session.id, me.id);
    await swipe(session.id, me.id, movie.id, choice);
    return Response.json(await sessionState(session.id, me.id));
  });
}
