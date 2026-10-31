// "Help me pick": turns answers into a deck of movies, and runs swipe sessions
// that you can do alone or with friends. Server only.
import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "./db";
import { type Answers, DECADES, MOOD_GENRES, QUESTIONS } from "./questions";
import { discover, type Found, GENRES, getDetails } from "./tmdb";
import type { Movie } from "./types";

export type Fit = { label: string; ok: boolean };
export type Card = Movie & {
  genres: string[];
  overview: string;
  backdropPath: string | null;
  director: string;
  cast: string[];
  rating: number;
  fits: Fit[];
};

const DECK_SIZE = 20;
const label = (key: keyof Answers, value: string) =>
  QUESTIONS.find((q) => q.key === key)?.choices.find((c) => c.value === value)?.label ?? value;

type Info = { genreIds: number[]; year: number; runtime: number; votes: number; rating: number; language: string };

// Which of your answers a movie fits, one line per question you answered.
export function fitsFor(a: Answers, m: Info): Fit[] {
  const fits: Fit[] = [];
  if (a.genres?.length) {
    const hit = a.genres.find((g) => m.genreIds.includes(Number(g)));
    fits.push({ label: hit ? label("genres", hit) : a.genres.map((g) => label("genres", g)).join(" or "), ok: !!hit });
  }
  const decades = a.decades?.filter((d) => d !== "any") ?? [];
  if (decades.length) {
    const hit = decades.find((d) => m.year >= DECADES[d][0] && m.year <= DECADES[d][1]);
    fits.push({ label: hit ? label("decades", hit) : decades.map((d) => label("decades", d)).join(" or "), ok: !!hit });
  }
  for (const mood of a.moods ?? []) {
    fits.push({ label: label("moods", mood), ok: MOOD_GENRES[mood].some((g) => m.genreIds.includes(g)) });
  }
  if (a.length && a.length !== "any") {
    fits.push({ label: label("length", a.length), ok: m.runtime > 0 && m.runtime <= Number(a.length) });
  }
  if (a.fame === "known") fits.push({ label: "Well known", ok: m.votes >= 3000 });
  if (a.fame === "gem") fits.push({ label: "A hidden gem", ok: m.votes < 3000 });
  if (a.rating && a.rating !== "any") fits.push({ label: `Rated ${a.rating}+`, ok: m.rating >= Number(a.rating) });
  if (a.language === "en") fits.push({ label: "In English", ok: m.language === "en" });
  if (a.language === "other") fits.push({ label: "Not in English", ok: m.language !== "en" });
  return fits;
}

// Turns answers into TMDB "discover" filters. `loose` drops the stricter ones when too few movies come back.
function filters(a: Answers, loose: boolean) {
  const p: Record<string, string> = { sort_by: "popularity.desc", "vote_count.gte": "200", "with_runtime.gte": "60" };
  const genres = a.genres?.length ? a.genres : (a.moods ?? []).flatMap((m) => MOOD_GENRES[m].map(String));
  if (genres.length) p.with_genres = [...new Set(genres)].join("|");
  const decades = a.decades?.filter((d) => d !== "any") ?? [];
  if (decades.length && !loose) {
    p["primary_release_date.gte"] = `${Math.min(...decades.map((d) => DECADES[d][0]))}-01-01`;
    p["primary_release_date.lte"] = `${Math.max(...decades.map((d) => Math.min(DECADES[d][1], new Date().getFullYear())))}-12-31`;
  }
  if (a.length === "90" || a.length === "120") p["with_runtime.lte"] = a.length;
  if (a.fame === "known") p["vote_count.gte"] = "3000";
  if (a.fame === "gem") {
    p["vote_count.gte"] = "150";
    p["vote_count.lte"] = "3000";
    p.sort_by = "vote_average.desc";
  }
  if (a.rating && a.rating !== "any" && !loose) p["vote_average.gte"] = a.rating;
  if (a.language === "en") p.with_original_language = "en";
  if (a.who === "family") {
    p.certification_country = "US";
    p["certification.lte"] = "PG-13";
    p.without_genres = "27";
  }
  return p;
}

function shuffle<T>(list: T[]) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Finds about 20 movies for your answers, skipping ones already in your queue.
// The best fits come first, with a little shuffling so every round feels different.
export async function buildDeck(a: Answers, skip: Set<string>): Promise<{ deck: Card[]; loosened: boolean }> {
  const decades = a.decades?.filter((d) => d !== "any") ?? [];
  const keep = (m: Found) => {
    if (skip.has(`tmdb-${m.id}`) || !m.title) return false;
    if (a.language === "other" && m.original_language === "en") return false;
    return true;
  };
  async function fetchSome(loose: boolean) {
    const p = filters(a, loose);
    const pages = await Promise.all([1, 2, 3].map((page) => discover({ ...p, page: String(page) }).catch(() => [])));
    const seen = new Set<number>();
    return pages.flat().filter((m) => !seen.has(m.id) && seen.add(m.id) && keep(m));
  }

  let found = await fetchSome(false);
  // Keep only the decades picked (the filter above covers the whole span between them).
  if (decades.length) {
    found = found.filter((m) => {
      const y = Number(m.release_date?.slice(0, 4));
      return decades.some((d) => y >= DECADES[d][0] && y <= DECADES[d][1]);
    });
  }
  let loosened = false;
  if (found.length < 8) {
    loosened = true;
    const more = await fetchSome(true);
    const ids = new Set(found.map((m) => m.id));
    found = [...found, ...more.filter((m) => !ids.has(m.id))];
  }

  const quick = (m: Found) =>
    fitsFor(a, {
      genreIds: m.genre_ids ?? [], year: Number(m.release_date?.slice(0, 4)) || 0, runtime: 0,
      votes: m.vote_count ?? 0, rating: m.vote_average ?? 0, language: m.original_language ?? "",
    }).filter((f) => f.ok).length;
  const picked = shuffle(found)
    .map((m) => ({ m, score: quick(m) + Math.random() * 1.5 }))
    .sort((x, y) => y.score - x.score)
    .slice(0, DECK_SIZE)
    .map((x) => x.m);

  // Look up runtimes, directors and cast for the chosen few (all at once).
  const deck = await Promise.all(
    picked.map(async (m): Promise<Card> => {
      const d = await getDetails(m.id).catch(() => null);
      const genreIds = d?.genreIds ?? m.genre_ids ?? [];
      const movie: Movie = d?.movie ?? {
        id: `tmdb-${m.id}`, tmdbId: m.id, title: m.title, year: m.release_date?.slice(0, 4) ?? "", runtime: 0, posterPath: m.poster_path ?? null,
      };
      return {
        ...movie,
        genres: genreIds.map((g) => GENRES[g]).filter(Boolean).slice(0, 3),
        overview: (d?.overview ?? m.overview ?? "").slice(0, 600),
        backdropPath: d?.backdrop ?? m.backdrop_path ?? null,
        director: d?.director ?? "",
        cast: d?.cast.slice(0, 3) ?? [],
        rating: Math.round((d?.rating ?? m.vote_average ?? 0) * 10) / 10,
        fits: fitsFor(a, {
          genreIds, year: Number(movie.year) || 0, runtime: movie.runtime, votes: d?.votes ?? m.vote_count ?? 0,
          rating: d?.rating ?? m.vote_average ?? 0, language: m.original_language ?? "",
        }),
      };
    }),
  );
  return { deck, loosened };
}

// ---------- Swipe sessions ----------

export type Choice = "like" | "pass" | "seen";
export const cleanChoice = (raw: unknown): Choice | null => (raw === "like" || raw === "pass" || raw === "seen" ? raw : null);
export const cleanPickToken = (raw: string) => (/^[A-Za-z0-9_-]{8,32}$/.test(raw) ? raw : null);

export type Session = { id: string; token: string; host: string; hostId: string; answers: Answers; deck: Card[]; loosened: boolean };

export async function createSession(hostId: string, answers: Answers, deck: Card[], loosened: boolean) {
  const token = randomBytes(9).toString("base64url");
  const rows = await sql<{ id: string }>(
    "INSERT INTO swipe_sessions (token, host_id, answers, deck, loosened) VALUES ($1, $2, $3, $4, $5) RETURNING id::text",
    [token, hostId, JSON.stringify(answers), JSON.stringify(deck), loosened],
  );
  await sql("INSERT INTO swipe_members (session_id, user_id) VALUES ($1, $2)", [rows[0].id, hostId]);
  return token;
}

export async function getSession(token: string): Promise<Session | null> {
  const rows = await sql<{ id: string; token: string; host: string; host_id: string; answers: Answers; deck: Card[]; loosened: boolean }>(
    `SELECT s.id::text, s.token, u.username AS host, s.host_id::text, s.answers, s.deck, s.loosened
     FROM swipe_sessions s JOIN users u ON u.id = s.host_id WHERE s.token = $1`,
    [token],
  );
  const r = rows[0];
  return r ? { id: r.id, token: r.token, host: r.host, hostId: r.host_id, answers: r.answers, deck: r.deck, loosened: r.loosened } : null;
}

// Opening someone's swipe link adds you to the session.
export async function joinSession(sessionId: string, userId: string) {
  await sql("INSERT INTO swipe_members (session_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [sessionId, userId]);
}

export async function swipe(sessionId: string, userId: string, movieId: string, choice: Choice) {
  await sql(
    `INSERT INTO swipe_votes (session_id, user_id, movie_id, choice) VALUES ($1, $2, $3, $4)
     ON CONFLICT (session_id, user_id, movie_id) DO UPDATE SET choice = EXCLUDED.choice`,
    [sessionId, userId, movieId, choice],
  );
}

export type SessionState = {
  members: string[];
  mine: Record<string, Choice>;
  matches: string[]; // movie ids everyone in the session wants to watch
  likes: Record<string, number>; // how many people liked each movie
};

// Who's swiping, what I've swiped, and the matches so far.
// Alone, every "watch it" is a match. With friends, a match is a movie everyone said yes to.
export async function sessionState(sessionId: string, userId: string): Promise<SessionState> {
  const [members, votes] = await Promise.all([
    sql<{ id: string; username: string }>(
      `SELECT u.id::text, u.username FROM swipe_members m JOIN users u ON u.id = m.user_id
       WHERE m.session_id = $1 ORDER BY m.joined_at`,
      [sessionId],
    ),
    sql<{ user_id: string; movie_id: string; choice: Choice }>(
      "SELECT user_id::text, movie_id, choice FROM swipe_votes WHERE session_id = $1",
      [sessionId],
    ),
  ]);
  const mine: Record<string, Choice> = {};
  const likes: Record<string, number> = {};
  for (const v of votes) {
    if (v.user_id === userId) mine[v.movie_id] = v.choice;
    if (v.choice === "like") likes[v.movie_id] = (likes[v.movie_id] ?? 0) + 1;
  }
  const matches = Object.entries(likes).filter(([, n]) => n >= members.length).map(([id]) => id);
  return { members: members.map((m) => m.username), mine, matches, likes };
}
