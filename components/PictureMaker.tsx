"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COLORS, type Color, colorOf, fit, MIN_CUT, type Pic, POSTER_H, type Shape, SHAPES, shapeOf } from "@/lib/avatar";
import type { Movie } from "@/lib/types";
import { PicArt, rememberPic } from "./Avatar";
import { SearchIcon } from "./icons";
import Poster from "./Poster";
import TmdbCredit from "./TmdbCredit";

type Props = { username: string; current: Pic | null; queue: Movie[] };
type Picked = { tmdbId: number; title: string };

const img = (size: string, path: string) => `https://image.tmdb.org/t/p/${size}${path}`;

// "Make your picture": pick a movie, pick one of its posters, line up a cutter
// shape over it, and choose a background color.
export default function PictureMaker({ username, current, queue }: Props) {
  const router = useRouter();
  const [movie, setMovie] = useState<Picked | null>(current ? { tmdbId: current.tmdbId, title: current.title } : null);
  const [posters, setPosters] = useState<string[]>(current ? [current.poster] : []);
  const [poster, setPoster] = useState(current?.poster ?? "");
  const [cut, setCut] = useState(current ? { x: current.x, y: current.y, size: current.size } : { x: 20, y: 18, size: 60 });
  const [shape, setShape] = useState<Shape>(current?.shape ?? "head");
  const [color, setColor] = useState<Color>(current?.color ?? "red");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingPosters, setLoadingPosters] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const term = q.trim();

  const fromQueue = queue.filter((m) => m.tmdbId && m.posterPath);

  // Search movies as you type.
  useEffect(() => {
    if (!term) return setResults([]);
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults((data.results ?? []).filter((m: Movie) => m.tmdbId && m.posterPath));
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      }
      if (!ctrl.signal.aborted) setSearching(false);
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  // Every poster for the chosen movie.
  async function choose(m: Movie) {
    if (!m.tmdbId) return;
    setMovie({ tmdbId: m.tmdbId, title: m.title });
    setPoster(m.posterPath ?? "");
    setPosters(m.posterPath ? [m.posterPath] : []);
    setQ("");
    setError("");
    setLoadingPosters(true);
    try {
      const res = await fetch(`/api/movie/${m.tmdbId}/posters`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const list: string[] = data.posters ?? [];
      const all = m.posterPath ? [m.posterPath, ...list.filter((p) => p !== m.posterPath)] : list;
      setPosters(all);
      if (!m.posterPath && all[0]) setPoster(all[0]);
    } catch {
      // The main poster still works without the rest.
    }
    setLoadingPosters(false);
  }

  // Load the other posters when you come back to change your picture.
  useEffect(() => {
    if (!current) return;
    fetch(`/api/movie/${current.tmdbId}/posters`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.posters && setPosters([current.poster, ...d.posters.filter((p: string) => p !== current.poster)]))
      .catch(() => {});
  }, [current]);

  const move = (x: number, y: number, size = cut.size) => setCut(fit(x, y, size));
  // Resizing keeps the cutter centered where it was.
  const resize = (size: number) => {
    const s = Math.min(100, Math.max(MIN_CUT, size));
    setCut((c) => fit(c.x + (c.size - s) / 2, c.y + (c.size - s) / 2, s));
  };

  // Drag with one finger (or the mouse) to move, pinch with two to resize.
  const unit = () => (stage.current?.clientWidth ?? 260) / 100;
  function down(e: React.PointerEvent) {
    stage.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  function moveP(e: React.PointerEvent) {
    const ps = pointers.current;
    const prev = ps.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    if (ps.size === 1) {
      const u = unit();
      setCut((c) => fit(c.x + (now.x - prev.x) / u, c.y + (now.y - prev.y) / u, c.size));
    } else if (ps.size === 2) {
      const other = [...ps.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(now.x - other.x, now.y - other.y);
      if (before > 0) setCut((c) => {
        const s = Math.min(100, Math.max(MIN_CUT, c.size * (after / before)));
        return fit(c.x + (c.size - s) / 2, c.y + (c.size - s) / 2, s);
      });
    }
    ps.set(e.pointerId, now);
  }
  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
  }
  function wheel(e: React.WheelEvent) {
    resize(cut.size * (e.deltaY > 0 ? 1.06 : 0.94));
  }
  function key(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 8 : 2;
    const k: Record<string, () => void> = {
      ArrowLeft: () => move(cut.x - step, cut.y),
      ArrowRight: () => move(cut.x + step, cut.y),
      ArrowUp: () => move(cut.x, cut.y - step),
      ArrowDown: () => move(cut.x, cut.y + step),
      "+": () => resize(cut.size + 4),
      "=": () => resize(cut.size + 4),
      "-": () => resize(cut.size - 4),
    };
    if (k[e.key]) {
      e.preventDefault();
      k[e.key]();
    }
  }

  const pic: Pic | null = movie && poster ? { tmdbId: movie.tmdbId, title: movie.title, poster, ...cut, shape, color } : null;
  const path = shapeOf(shape).path;

  async function save() {
    if (!pic) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/profile/picture", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pic }),
      });
      if (res.status === 401) return window.location.reload();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save. Try again.");
      rememberPic(username, data.pic);
      router.push("/profile");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    const res = await fetch("/api/profile/picture", { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      rememberPic(username, null);
      router.push("/profile");
      router.refresh();
    } else {
      setError("That didn't work. Try again.");
      setBusy(false);
    }
  }

  const tiles = term ? results : fromQueue;

  return (
    <div className="app">
      <div className="formbar">
        <Link className="link plain" href="/profile">Cancel</Link>
        <b>Make your picture</b>
        <button className="link plain right" disabled={!pic || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>

      <div className="picmaker">
        <section className="step">
          <span className="label">1 · Pick a poster</span>
          <label className="searchbox">
            <span className="sr">Search movies</span>
            <SearchIcon size={18} />
            <input type="search" placeholder="Search movies" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {!term && fromQueue.length > 0 && <small className="hint">From your queue</small>}
          {term && searching && <small className="hint">Searching…</small>}
          {term && !searching && results.length === 0 && <small className="hint">No posters for “{term}”.</small>}
          {tiles.length > 0 && (
            <div className="ptiles" aria-label="Movies">
              {tiles.map((m) => (
                <button key={m.id} aria-pressed={!term && movie?.tmdbId === m.tmdbId} onClick={() => choose(m)}>
                  <Poster movie={m} size="md" />
                  <small>{m.title}</small>
                </button>
              ))}
            </div>
          )}
          {movie && !term && posters.length > 0 && (
            <>
              <small className="hint">Posters for {movie.title}</small>
              <div className="ptiles" aria-label={`Posters for ${movie.title}`}>
                {posters.map((p, i) => (
                  <button key={p} aria-pressed={p === poster} aria-label={`Poster ${i + 1}`} onClick={() => setPoster(p)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img("w185", p)} alt="" loading="lazy" />
                  </button>
                ))}
                <span className="note">{loadingPosters ? "Finding more posters…" : "Every poster TMDB has for this movie"}</span>
              </div>
            </>
          )}
        </section>

        {pic && (
          <>
            <section className="step">
              <span className="label">2 · Line up the cutter</span>
              <div
                className="stage"
                ref={stage}
                onPointerDown={down}
                onPointerMove={moveP}
                onPointerUp={up}
                onPointerCancel={up}
                onWheel={wheel}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img("w500", poster)} alt={`Poster for ${movie!.title}`} draggable={false} />
                <svg className="shade" viewBox={`0 0 100 ${POSTER_H}`} preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <mask id="cutmask">
                      <rect width="100" height={POSTER_H} fill="white" />
                      <path d={path} fill="black" transform={`translate(${cut.x} ${cut.y}) scale(${cut.size / 100})`} />
                    </mask>
                  </defs>
                  <rect width="100" height={POSTER_H} fill="rgba(0,0,0,.55)" mask="url(#cutmask)" />
                </svg>
                <div
                  className="cutter"
                  tabIndex={0}
                  role="group"
                  aria-label="Cutter. Use the arrow keys to move it, and plus or minus to resize."
                  onKeyDown={key}
                  style={{ left: `${cut.x}%`, top: `${(cut.y / POSTER_H) * 100}%`, width: `${cut.size}%`, height: `${(cut.size / POSTER_H) * 100}%` }}
                >
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
                  </svg>
                </div>
                <span className="tip">Drag to move · pinch to resize</span>
              </div>
              <label className="zoom">
                <span>Size</span>
                <input type="range" min={MIN_CUT} max={100} step={1} value={cut.size} onChange={(e) => resize(Number(e.target.value))} aria-valuetext={`${Math.round(cut.size)}% of the poster's width`} />
              </label>
            </section>

            <section className="step">
              <span className="label">3 · Cutter shape</span>
              <div className="shapes">
                {SHAPES.map((s) => (
                  <button key={s.id} aria-pressed={shape === s.id} onClick={() => setShape(s.id)}>
                    <svg width="26" height="26" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path d={s.path} /></svg>
                    {s.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="step">
              <span className="label">4 · Background</span>
              <div className="swatches">
                {COLORS.map((c) => (
                  <button key={c.id} aria-label={`${c.label} background`} aria-pressed={color === c.id} style={{ background: c.value }} onClick={() => setColor(c.id)} />
                ))}
              </div>
            </section>

            <div className="pic-preview">
              <PicArt pic={pic} size={96} />
              <div>
                <b>Your new picture</b>
                <small>From {movie!.title}, on {colorOf(color).label.toLowerCase()}. Friends can tap it to see the movie.</small>
              </div>
            </div>
          </>
        )}

        {!pic && <div className="hint">Pick a movie to start. Your picture is cut from one of its posters.</div>}
        {error && <div className="full" role="alert">{error}</div>}
        {pic && <button className="pill big" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save picture"}</button>}
        {current && <button className="link plain" disabled={busy} onClick={remove}>Go back to my letter</button>}
      </div>
      <TmdbCredit />
    </div>
  );
}
