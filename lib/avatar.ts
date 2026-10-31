// Profile pictures made from a movie poster: which poster, where the cutter sits,
// its shape and the background color. Shared by the browser and the server.
// Only these settings are saved. The poster itself always loads from TMDB.

export const SHAPES = [
  { id: "head", label: "Head", path: "M50 9C59.5 9 66 16.5 66 27C66 29 66 30.5 65.8 32C67.5 31.5 68.6 33 68.2 35.5C67.8 38.5 66.6 40.5 64.8 40.6C63.6 45.5 61 49.5 57.5 52.5L57.5 58C60 61.5 66 63.5 75 65.5C85 67.5 91.5 72 93.5 80L96 100L4 100L6.5 80C8.5 72 15 67.5 25 65.5C34 63.5 40 61.5 42.5 58L42.5 52.5C39 49.5 36.4 45.5 35.2 40.6C33.4 40.5 32.2 38.5 31.8 35.5C31.4 33 32.5 31.5 34.2 32C34 30.5 34 29 34 27C34 16.5 40.5 9 50 9Z" },
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
