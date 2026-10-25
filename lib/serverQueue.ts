// Reading and saving a person's queue in the database. Server only.
import "server-only";
import { sql } from "./db";
import { MAX } from "./queue";
import type { Movie } from "./types";

// Only keep the fields we expect, so nobody can stuff odd data into the database.
export function cleanQueue(input: unknown): Movie[] {
  if (!Array.isArray(input)) return [];
  const out: Movie[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (out.length >= MAX) break;
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    const id = typeof m.id === "string" ? m.id.slice(0, 120) : "";
    const title = typeof m.title === "string" ? m.title.trim().slice(0, 200) : "";
    if (!/^(tmdb|custom)-/.test(id) || !title || seen.has(id)) continue;
    seen.add(id);
    const movie: Movie = {
      id,
      title,
      year: typeof m.year === "string" ? m.year.slice(0, 4) : "",
      runtime: typeof m.runtime === "number" && m.runtime > 0 ? Math.min(Math.round(m.runtime), 2000) : 0,
    };
    if (typeof m.tmdbId === "number" && Number.isInteger(m.tmdbId)) movie.tmdbId = m.tmdbId;
    if (m.posterPath === null || (typeof m.posterPath === "string" && /^\/[\w.-]{1,100}$/.test(m.posterPath))) {
      movie.posterPath = m.posterPath;
    }
    if (typeof m.addedBy === "string" && /^[a-z0-9_.]{3,20}$/.test(m.addedBy)) movie.addedBy = m.addedBy;
    out.push(movie);
  }
  return out;
}

export async function getQueue(userId: string): Promise<Movie[]> {
  const rows = await sql<{ queue: unknown }>("SELECT queue FROM users WHERE id = $1", [userId]);
  return cleanQueue(rows[0]?.queue);
}

export async function setQueue(userId: string, queue: Movie[]) {
  await sql("UPDATE users SET queue = $2 WHERE id = $1", [userId, JSON.stringify(queue)]);
}

// Logging in on a browser that already had movies saved: keep the account's
// movies first, then add the browser's ones that aren't there yet, up to 10.
export function mergeQueues(account: Movie[], local: Movie[]) {
  const ids = new Set(account.map((m) => m.id));
  return [...account, ...local.filter((m) => !ids.has(m.id))].slice(0, MAX);
}
