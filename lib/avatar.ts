// Profile pictures made from a movie poster: which poster, where the cutter sits,
// its shape and the background color. Shared by the browser and the server.
// Only these settings are saved. The poster itself always loads from TMDB.

export const SHAPES = [
  { id: "head", label: "Head", path: "M50 4C61.6 4 69.5 13.2 69.5 26C69.5 28.4 69.5 30.2 69.3 32.1C71.3 31.4 72.7 33.3 72.2 36.3C71.7 40 70.3 42.4 68.1 42.6C66.6 48.5 63.4 53.4 59.1 57.1L57.5 63C59.5 66.5 63.5 68.6 70 70.6C78 72.6 83.2 77.1 84.8 85.1L86.8 100L13.2 100L15.2 85.1C16.8 77.1 22 72.6 30 70.6C36.5 68.6 40.5 66.5 42.5 63L40.9 57.1C36.6 53.4 33.4 48.5 31.9 42.6C29.7 42.4 28.3 40 27.8 36.3C27.3 33.3 28.7 31.4 30.7 32.1C30.5 30.2 30.5 28.4 30.5 26C30.5 13.2 38.4 4 50 4Z" },
  { id: "face", label: "Face", path: "M50 8a32 42 0 110 84a32 42 0 110-84z" },
  { id: "circle", label: "Circle", path: "M50 0a50 50 0 110 100a50 50 0 110-100z" },
  { id: "star", label: "Star", path: "M50 6l13 28 30 3-23 20 7 30-27-16-27 16 7-30L7 37l30-3z" },
  { id: "heart", label: "Heart", path: "M50 88S10 62 10 34a20 20 0 0140-4 20 20 0 0140 4c0 28-40 54-40 54z" },
] as const;

export const COLORS = [
  { id: "red", label: "Red", value: "#d23b3b" },
  { id: "blue", label: "Light blue", value: "#7cc4ff" },
  { id: "orange", label: "Orange", value: "#ff7a3d" },
  { id: "yellow", label: "Yellow", value: "#f2c94c" },
  { id: "green", label: "Green", value: "#3d9a5f" },
  { id: "grey", label: "Grey", value: "#5a5a66" },
  { id: "white", label: "White", value: "#f2f2f2" },
] as const;

export type Shape = (typeof SHAPES)[number]["id"];
export type Color = (typeof COLORS)[number]["id"];

// The poster is measured as 100 wide by 150 tall. The cutter is a square:
// x and y are its top left corner, size is its width, all in those units.
export type Pic = {
  tmdbId: number;
  title: string;
  poster: string; // TMDB poster path, like "/abc123.jpg"
  x: number;
  y: number;
  size: number;
  shape: Shape;
  color: Color;
};

export const MIN_CUT = 12;
export const POSTER_H = 150;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const round = (v: number) => Math.round(v * 10) / 10;

// Keeps the cutter inside the poster.
export function fit(x: number, y: number, size: number) {
  const s = Math.min(100, Math.max(MIN_CUT, size));
  return { size: round(s), x: round(Math.min(100 - s, Math.max(0, x))), y: round(Math.min(POSTER_H - s, Math.max(0, y))) };
}

// Checks a picture sent from the browser. Returns null if anything is off.
export function cleanPic(raw: unknown): Pic | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const tmdbId = num(r.tmdbId), x = num(r.x), y = num(r.y), size = num(r.size);
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || [x, y, size].some(Number.isNaN)) return null;
  if (typeof r.poster !== "string" || !/^\/[A-Za-z0-9_-]{4,64}\.(jpg|jpeg|png)$/.test(r.poster)) return null;
  if (!SHAPES.some((s) => s.id === r.shape) || !COLORS.some((c) => c.id === r.color)) return null;
  const title = typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
  return { tmdbId, title, poster: r.poster, ...fit(x, y, size), shape: r.shape as Shape, color: r.color as Color };
}

export const shapeOf = (id: Shape) => SHAPES.find((s) => s.id === id) ?? SHAPES[0];
export const colorOf = (id: Color) => COLORS.find((c) => c.id === id) ?? COLORS[0];

// The smallest TMDB image that still looks sharp at this size on a phone screen.
export function posterWidth(displayPx: number, cutSize: number) {
  const need = (displayPx * 100 / cutSize) * 2;
  return need <= 185 ? "w185" : need <= 342 ? "w342" : need <= 500 ? "w500" : "w780";
}
