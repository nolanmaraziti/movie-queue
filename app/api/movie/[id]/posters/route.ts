// GET /api/movie/496243/posters
// Every poster TMDB has for one movie, for the profile picture maker.
import { getPosters, TmdbError } from "@/lib/tmdb";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "Bad movie id." }, { status: 400 });
  try {
    return Response.json({ posters: await getPosters(Number(id)) });
  } catch (err) {
    console.error(err);
    const message = err instanceof TmdbError ? err.message : "Couldn't load posters.";
    return Response.json({ error: message }, { status: 502 });
  }
}
