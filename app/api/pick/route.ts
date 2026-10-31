// POST /api/pick  { answers }
// Builds a deck of movies from your "Help me pick" answers and starts a swipe session.
import { fail, readJson, signedIn } from "@/lib/api";
import { buildDeck, createSession } from "@/lib/pick";
import { cleanAnswers } from "@/lib/questions";
import { getQueue } from "@/lib/serverQueue";
import { TmdbError } from "@/lib/tmdb";

export function POST(request: Request) {
  return signedIn(async (me) => {
    const answers = cleanAnswers((await readJson(request)).answers);
    const queue = await getQueue(me.id);
    try {
      const { deck, loosened } = await buildDeck(answers, new Set(queue.map((m) => m.id)));
      if (deck.length === 0) return fail("No movies fit those answers. Try choosing a few more options.", 404);
      return Response.json({ token: await createSession(me.id, answers, deck, loosened) });
    } catch (err) {
      if (err instanceof TmdbError) return fail(err.message, 502);
      throw err;
    }
  });
}
