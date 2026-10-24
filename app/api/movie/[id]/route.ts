// GET /api/movie/496243
// Fetches one movie's details (poster, year, runtime) from TMDB.
import { getMovie, TmdbError } from "@/lib/tmdb";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "Bad movie id." }, { status: 400 });

  try {
    return Response.json({ movie: await getMovie(Number(id)) });
  } catch (err) {
    console.error(err);
    const message = err instanceof TmdbError ? err.message : "Lookup failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
