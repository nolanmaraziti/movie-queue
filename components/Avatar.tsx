"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { type Pic, colorOf, POSTER_H, posterWidth, shapeOf } from "@/lib/avatar";

// Everyone's profile pictures, fetched a batch at a time and kept for the visit.
// A screen full of names makes one request, not one per name.
const cache = new Map<string, Pic | null>();
const listeners = new Set<() => void>();
let waiting = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

function notify() {
  for (const l of listeners) l();
}

async function flush() {
  const names = [...waiting];
  waiting = new Set();
  timer = undefined;
  try {
    const res = await fetch(`/api/avatars?u=${names.map(encodeURIComponent).join(",")}`);
    const pics: Record<string, Pic> = res.ok ? (await res.json()).pics ?? {} : {};
    for (const n of names) if (!cache.has(n)) cache.set(n, pics[n] ?? null);
  } catch {
    for (const n of names) if (!cache.has(n)) cache.set(n, null);
  }
  notify();
}

function want(username: string) {
  if (cache.has(username) || waiting.has(username)) return;
  waiting.add(username);
  timer ??= setTimeout(flush, 10);
}

// Called after you save a new picture, so it shows everywhere right away.
export function rememberPic(username: string, pic: Pic | null) {
  cache.set(username, pic);
  notify();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// The picture itself: the part of the poster inside the cutter, on a colored circle.
export function PicArt({ pic, size }: { pic: Pic; size: number }) {
  const id = "pic" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const k = 100 / pic.size;
  const src = `https://image.tmdb.org/t/p/${posterWidth(size, pic.size)}${pic.poster}`;
  return (
    <span className="avatar pic" aria-hidden="true" style={{ width: size, height: size, background: colorOf(pic.color).value }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <clipPath id={id}><path d={shapeOf(pic.shape).path} /></clipPath>
        </defs>
        <image
          href={src}
          x={-pic.x * k}
          y={-pic.y * k}
          width={100 * k}
          height={POSTER_H * k}
          preserveAspectRatio="none"
          clipPath={`url(#${id})`}
        />
      </svg>
    </span>
  );
}

// Someone's profile picture. Without one, the first letter of their username
// in a color picked from their name. Pass `pic` when the page already knows it.
export default function Avatar({ username, size = 40, pic }: { username: string; size?: number; pic?: Pic | null }) {
  const known = useSyncExternalStore(subscribe, () => cache.get(username), () => undefined);
  useEffect(() => {
    if (pic !== undefined) {
      if (cache.get(username) === undefined) cache.set(username, pic);
    } else want(username);
  }, [username, pic]);

  const shown = pic !== undefined ? pic : known;
  if (shown) return <PicArt pic={shown} size={size} />;

  let h = 0;
  for (const c of username) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: `hsl(${h % 360} 24% 38%)` }}
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}
