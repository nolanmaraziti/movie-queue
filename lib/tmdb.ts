// Talks to The Movie Database (TMDB). This file only ever runs on the server:
// the "server-only" import below makes the build fail if browser code tries to use it,
// so your TMDB token can never end up in the code that visitors download.
import "server-only";
import type { Movie } from "./types";

// TMDB_API_BASE is only for testing against a stand-in server; normally it is unset.
const API = process.env.TMDB_API_BASE?.trim() || "https://api.themoviedb.org/3";
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

// Movie genres on TMDB, by id.
export const GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama",
  10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Sci-fi", 53: "Thriller", 10752: "War", 37: "Western",
};

export type Found = {
  id: number;
  title: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  original_language?: string;
  overview?: string;
};

// TMDB's "discover": movies that match filters like genre, years, length and rating.
export async function discover(params: Record<string, string>): Promise<Found[]> {
  const data = await tmdb<{ results: Found[] }>("/discover/movie", { include_adult: "false", include_video: "false", ...params });
  return data.results ?? [];
}

export type Details = {
  movie: Movie;
  overview: string;
  genres: string[];
  genreIds: number[];
  backdrop: string | null;
  stills: string[];
  rating: number;
  votes: number;
  language: string;
  certification: string;
  director: string;
  directorId: number | null;
  cast: string[];
  providers: { name: string; logo: string | null }[];
  providerLink: string | null;
};

type RawDetails = TmdbMovie & {
  overview?: string;
  genres?: { id: number; name: string }[];
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  original_language?: string;
  spoken_languages?: { english_name?: string; iso_639_1: string }[];
  credits?: { cast?: { name: string }[]; crew?: { id: number; name: string; job: string }[] };
  release_dates?: { results?: { iso_3166_1: string; release_dates: { certification: string }[] }[] };
  images?: { backdrops?: { file_path: string }[] };
  "watch/providers"?: { results?: Record<string, { link?: string; flatrate?: { provider_name: string; logo_path?: string }[] }> };
};

// Everything for a movie's profile: credits, rating, pictures, and where to stream it (US).
export async function getDetails(id: number): Promise<Details> {
  const d = await tmdb<RawDetails>(`/movie/${id}`, {
    append_to_response: "credits,release_dates,images,watch/providers",
    include_image_language: "null,en",
  });
  const director = d.credits?.crew?.find((c) => c.job === "Director");
  const us = d.release_dates?.results?.find((r) => r.iso_3166_1 === "US");
  const watch = d["watch/providers"]?.results?.US;
  const lang = d.spoken_languages?.find((l) => l.iso_639_1 === d.original_language);
  return {
    movie: toMovie(d),
    overview: d.overview ?? "",
    genres: (d.genres ?? []).map((g) => GENRES[g.id] ?? g.name),
    genreIds: (d.genres ?? []).map((g) => g.id),
    backdrop: d.backdrop_path ?? null,
    stills: (d.images?.backdrops ?? []).slice(0, 5).map((b) => b.file_path),
    rating: d.vote_average ?? 0,
    votes: d.vote_count ?? 0,
    language: lang?.english_name ?? d.original_language ?? "",
    certification: us?.release_dates.find((r) => r.certification)?.certification ?? "",
    director: director?.name ?? "",
    directorId: director?.id ?? null,
    cast: (d.credits?.cast ?? []).slice(0, 4).map((c) => c.name),
    providers: (watch?.flatrate ?? []).slice(0, 6).map((p) => ({ name: p.provider_name, logo: p.logo_path ?? null })),
    providerLink: watch?.link ?? null,
  };
}
