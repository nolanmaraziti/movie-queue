// GET /api/search?q=dune
// The browser calls this, and this calls TMDB with the secret token.
import { searchMovies, TmdbError } from "@/lib/tmdb";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (!q) return Response.json({ results: [] });

  try {
    return Response.json({ results: await searchMovies(q) });
  } catch (err) {
    console.error(err);
    const message = err instanceof TmdbError ? err.message : "Search failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
