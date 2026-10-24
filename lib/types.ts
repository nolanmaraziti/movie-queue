// One movie in the queue or in the search results.
export type Movie = {
  id: string; // "tmdb-603", or "custom-..." for a title typed in by hand
  tmdbId?: number;
  title: string;
  year: string; // "" when unknown
  runtime: number; // minutes, 0 when unknown
  posterPath?: string | null; // TMDB poster file, e.g. "/abc123.jpg"
};
