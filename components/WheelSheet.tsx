"use client";

import { useEffect, useRef, useState } from "react";
import type { Movie } from "@/lib/types";
import { fmtRun } from "@/lib/queue";
import Poster from "./Poster";

type Props = {
  queue: Movie[];
  onUpNext: (id: string) => void;
  onClose: () => void;
};

type Mode = "pick" | "out";

const SPIN_MS = 4200;
const OUT_PAUSE_MS = 1100;
const SIZE = 300;
const R = SIZE / 2;

// Slice colors: light blue and dark grey take turns. With an odd number of slices,
// the last one gets a third color so it never touches a slice of the same color.
const COLORS = [
  { fill: "#7cc4ff", ink: "#0b2236" },
  { fill: "#3a3a40", ink: "#ffffff" },
  { fill: "#3d6f99", ink: "#ffffff" },
];

// A fair random whole number from 0 up to (but not including) n.
function random(n: number) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

// The point on the wheel's edge at `deg` degrees, going clockwise from the top.
function point(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return `${R + r * Math.cos(rad)} ${R + r * Math.sin(rad)}`;
}

// The spinning wheel. "Pick one" spins once and lands on a movie. "Knock out" removes
// whatever it lands on and keeps going until one movie is left. Knocking movies out
// only happens on the wheel: your actual queue isn't changed.
export default function WheelSheet({ queue, onUpNext, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("pick");
  const [left, setLeft] = useState<Movie[]>(queue);
  const [out, setOut] = useState<Movie[]>([]);
  const [landed, setLanded] = useState<Movie | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [turn, setTurn] = useState(0);
  const [animate, setAnimate] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      timers.current.forEach(clearTimeout);
    };
  }, [onClose]);

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  function reset(next: Mode) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMode(next);
    setLeft(queue);
    setOut([]);
    setLanded(null);
    setSpinning(false);
  }

  const n = left.length;
  const seg = 360 / n;
  const winner = mode === "out" && n === 1 ? left[0] : null;

  function spin() {
    if (spinning || n < 2) return;
    // Choose the movie first, then turn the wheel so that slice stops under the arrow,
    // somewhere inside the slice (not always dead center) after several full turns.
    const i = random(n);
    const target = i * seg + seg * (0.15 + 0.7 * (random(1000) / 1000));
    const now = ((turn % 360) + 360) % 360;
    const delta = (360 - target - now + 720) % 360;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setAnimate(true);
    setTurn(turn + 360 * 5 + delta);
    setSpinning(true);
    setLanded(null);
    const picked = left[i];
    later(() => {
      setSpinning(false);
      setLanded(picked);
      try { navigator.vibrate?.(30); } catch {}
      if (mode !== "out") return;
      // Show which one is out for a moment, then take it off the wheel.
      later(() => {
        setAnimate(false);
        setLeft((l) => l.filter((m) => m.id !== picked.id));
        setOut((o) => [...o, picked]);
        setLanded(null);
      }, OUT_PAUSE_MS);
    }, reduced ? 300 : SPIN_MS);
  }

  const result = mode === "pick" ? landed : winner;
  const isFirst = result && queue[0]?.id === result.id;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="wheelTitle">
        <div className="sheet-in wheel-in">
          <div className="sheet-head">
            <h3 id="wheelTitle">Spin the wheel</h3>
            <button className="close" onClick={onClose}>Done</button>
          </div>

          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={mode === "pick"} onClick={() => reset("pick")}>Pick one</button>
            <button role="tab" aria-selected={mode === "out"} onClick={() => reset("out")}>Knock out</button>
          </div>
          <div className="hint">
            {mode === "pick"
              ? "One spin picks the movie."
              : "Each spin knocks a movie out until one is left. Your queue stays the same."}
          </div>

          <div className="wheel-wrap">
            <div className="wheel-arrow" aria-hidden="true" />
            <svg
              className="wheel"
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              aria-hidden="true"
              style={{
                transform: `rotate(${turn}deg)`,
                transition: animate ? `transform ${SPIN_MS}ms cubic-bezier(.12,.65,.1,1)` : "none",
              }}
            >
              {left.map((m, i) => {
                const c = COLORS[n % 2 === 1 && i === n - 1 && n > 1 ? 2 : i % 2];
                const mid = i * seg + seg / 2;
                const title = m.title.length > 14 ? m.title.slice(0, 13) + "…" : m.title;
                const hit = landed?.id === m.id && !spinning;
                return (
                  <g key={m.id} className={hit ? (mode === "out" ? "slice out" : "slice hit") : "slice"}>
                    {n === 1 ? (
                      <circle cx={R} cy={R} r={R - 2} fill={c.fill} />
                    ) : (
                      <path
                        d={`M ${R} ${R} L ${point(i * seg, R - 2)} A ${R - 2} ${R - 2} 0 0 1 ${point((i + 1) * seg, R - 2)} Z`}
                        fill={c.fill}
                        stroke="#202023"
                        strokeWidth="2"
                      />
                    )}
                    <text
                      x={R}
                      y={R}
                      transform={`rotate(${mid - 90} ${R} ${R}) translate(${R - 16} 0)`}
                      textAnchor="end"
                      dominantBaseline="central"
                      fill={c.ink}
                      fontSize={n > 7 ? 11 : 13}
                      fontWeight="700"
                    >
                      {title}
                    </text>
                  </g>
                );
              })}
            </svg>
            <button
              className="wheel-hub"
              onClick={spin}
              disabled={spinning || n < 2}
              aria-label={winner ? "Done: one movie left" : "Spin the wheel"}
            >
              Spin
            </button>
          </div>

          <div aria-live="polite" className="wheel-result">
            {spinning && <div className="hint">Spinning…</div>}
            {mode === "out" && landed && <div className="full"><b>{landed.title}</b> is out.</div>}
            {mode === "out" && !winner && !landed && !spinning && (
              <div className="hint">
                {out.length === 0 ? `${n} movies on the wheel. Tap Spin to knock the first one out.` : `${n} left.`}
              </div>
            )}
            {result && (
              <div className="next">
                <Poster movie={result} size="md" />
                <div className="body">
                  <div className="label">{mode === "pick" ? "Tonight you're watching" : "Last one standing"}</div>
                  <h2>{result.title}</h2>
                  <div className="meta">
                    {[result.year, fmtRun(result.runtime), result.addedBy && `added by @${result.addedBy}`].filter(Boolean).join(" · ")}
                  </div>
                  <div className="actions wheel-actions">
                    {!isFirst && <button className="add" onClick={() => onUpNext(result.id)}>Make it up next</button>}
                    <button className="close" onClick={() => (mode === "pick" ? spin() : reset("out"))}>
                      {mode === "pick" ? "Spin again" : "Start over"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {out.length > 0 && (
              <div className="wheel-out">
                <div className="label">Knocked out</div>
                <ol>
                  {out.map((m, i) => (
                    <li key={m.id}><span className="num">{i + 1}</span><s>{m.title}</s></li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
