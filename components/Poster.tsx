import type { Movie } from "@/lib/types";

// The real TMDB poster when there is one, otherwise the colored tile from the prototype.
export default function Poster({ movie, size }: { movie: Movie; size: "xs" | "sm" | "md" | "lg" }) {
  if (movie.posterPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`poster img ${size}`}
        src={`https://image.tmdb.org/t/p/${size === "lg" ? "w500" : size === "md" ? "w185" : "w92"}${movie.posterPath}`}
        alt=""
        loading="lazy"
      />
    );
  }
  const h = hue(movie.title), h2 = (h + 40) % 360;
  const short = movie.title.length > 28 ? movie.title.slice(0, 26) + "…" : movie.title;
  return (
    <div
      className={`poster ${size}`}
      style={{ background: `linear-gradient(155deg,hsl(${h} 55% 42%),hsl(${h2} 60% 20%))` }}
    >
      <span>{short}</span>
    </div>
  );
}

function hue(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}
