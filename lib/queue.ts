// Saving the queue in this browser (localStorage), plus small display helpers.
import type { Movie } from "./types";

export const MAX = 10;
const KEY = "movie-queue-v1";

// First visit: start with a few example picks you can remove.
// Their posters are filled in from TMDB after the page loads.
const STARTERS: Movie[] = [
  { id: "tmdb-496243", tmdbId: 496243, title: "Parasite", year: "2019", runtime: 133 },
  { id: "tmdb-329865", tmdbId: 329865, title: "Arrival", year: "2016", runtime: 116 },
  { id: "tmdb-120467", tmdbId: 120467, title: "The Grand Budapest Hotel", year: "2014", runtime: 100 },
];

export function loadQueue(): Movie[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return STARTERS;
}

export function saveQueue(queue: Movie[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {}
}

export function fmtRun(min: number) {
  if (!min) return "";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
}
