// Talks to The Movie Database (TMDB). This file only ever runs on the server:
// the "server-only" import below makes the build fail if browser code tries to use it,
// so your TMDB token can never end up in the code that visitors download.
import "server-only";
import type { Movie } from "./types";

const API = "https://api.themoviedb.org/3";
const CACHE_SECONDS = 60 * 60 * 24; // reuse TMDB answers for a day

export class TmdbError extends Error {}

type TmdbMovie = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  runtime?: number | null;
};

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.TMDB_API_TOKEN?.trim();
  if (!token) {
    throw new TmdbError("TMDB_API_TOKEN is missing. Add it to .env.local on your computer, or to Environment Variables on Vercel.");
  }

  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  // TMDB gives you two keys. The long "API Read Access Token" is sent as a header.
  // The short 32-character "API Key" is sent in the URL. Accept either one.
  const headers: HeadersInit = { accept: "application/json" };
  if (/^[0-9a-f]{32}$/i.test(token)) url.searchParams.set("api_key", token);
  else headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, next: { revalidate: CACHE_SECONDS } });
  if (res.status === 401) throw new TmdbError("TMDB rejected the token. Check the TMDB_API_TOKEN you saved.");
  if (!res.ok) throw new TmdbError(`TMDB request failed (${res.status}).`);
  return res.json() as Promise<T>;
}

function toMovie(m: TmdbMovie): Movie {
  return {
    id: `tmdb-${m.id}`,
    tmdbId: m.id,
    title: m.title,
    year: m.release_date?.slice(0, 4) ?? "",
    runtime: m.runtime ?? 0,
    posterPath: m.poster_path ?? null,
  };
}

export async function getMovie(id: number): Promise<Movie> {
  return toMovie(await tmdb<TmdbMovie>(`/movie/${id}`));
}

// Search results from TMDB don't include runtimes, so we look up the details
// of the top matches too (all at once, in parallel).
export async function searchMovies(query: string, limit = 10): Promise<Movie[]> {
  const data = await tmdb<{ results: TmdbMovie[] }>("/search/movie", { query, include_adult: "false" });
  const top = data.results.slice(0, limit);
  return Promise.all(top.map((m) => getMovie(m.id).catch(() => toMovie(m))));
}

export type CastCrew = { id: number; name: string; job: string; movies: Movie[] };

type TmdbPerson = {
  id: number;
  name: string;
  known_for_department?: string;
  known_for?: (TmdbMovie & { media_type?: string })[];
};

// Search for actors and filmmakers. Each comes with the movies they're best known for.
export async function searchPeople(query: string, limit = 6): Promise<CastCrew[]> {
  const data = await tmdb<{ results: TmdbPerson[] }>("/search/person", { query, include_adult: "false" });
  return data.results
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      name: p.name,
      job: p.known_for_department === "Acting" ? "Actor" : p.known_for_department === "Directing" ? "Director" : (p.known_for_department ?? ""),
      movies: (p.known_for ?? []).filter((m) => m.media_type === "movie" && m.title).map(toMovie),
    }))
    .filter((p) => p.movies.length > 0);
}
