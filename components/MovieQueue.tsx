"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Movie } from "@/lib/types";
import { fmtRun, loadQueue, MAX, saveQueue } from "@/lib/queue";
import QueueList from "./QueueList";
import SearchSheet from "./SearchSheet";
import TmdbCredit from "./TmdbCredit";

export default function MovieQueue() {
  const [queue, setQueue] = useState<Movie[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fabRef = useRef<HTMLButtonElement>(null);

  // Save to this browser on every change.
  function update(next: Movie[]) {
    setQueue(next);
    saveQueue(next);
  }

  // Load the saved queue once the page is open in the browser.
  useEffect(() => {
    const saved = loadQueue();
    setQueue(saved);
    setLoaded(true);

    // Fill in posters for TMDB movies saved without one (like the starter picks).
    for (const m of saved) {
      if (!m.tmdbId || m.posterPath !== undefined) continue;
      fetch(`/api/movie/${m.tmdbId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.movie) return;
          setQueue((q) => {
            const next = q.map((x) => (x.id === m.id ? { ...x, ...data.movie } : x));
            saveQueue(next);
            return next;
          });
        })
        .catch(() => {});
    }
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 1800);
  }

  function move(from: number, to: number, announce: boolean) {
    if (to < 0 || to >= queue.length || from === to) return;
    const next = [...queue];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    update(next);
    if (announce) toast(to === 0 ? `“${m.title}” is up next` : `Moved “${m.title}” to #${to + 1}`);
  }

  function remove(id: string) {
    const m = queue.find((x) => x.id === id);
    update(queue.filter((x) => x.id !== id));
    if (m) toast(`Removed “${m.title}”`);
  }

  function add(m: Movie) {
    if (queue.length >= MAX) return toast("Queue is full");
    if (queue.some((x) => x.id === m.id)) return;
    const next = [...queue, m];
    update(next);
    toast(next.length === MAX ? `Added “${m.title}”. Queue is full.` : `Added “${m.title}”`);
  }

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    fabRef.current?.focus();
  }, []);

  const n = queue.length;
  const left = MAX - n;
  const total = queue.reduce((a, m) => a + (m.runtime || 0), 0);

  return (
    <>
      <div className="app">
        <header>
          <div className="top">
            <h1>Movie<br />Queue</h1>
            <div className="count">{n}<span>/{MAX}</span></div>
          </div>
          <div className="meter" aria-hidden="true">
            {Array.from({ length: MAX }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
          </div>
          <div className="sub">
            <span>{loaded && (left === 0 ? "Queue full" : `${left} ${left === 1 ? "slot" : "slots"} open`)}</span>
            <span>{total ? `${fmtRun(total)} of movies` : ""}</span>
          </div>
        </header>
        <main>
          {loaded && n === 0 && (
            <div className="empty">
              <strong>Nothing queued</strong>
              <span>Tap + to search for a movie and add it. You get ten slots.</span>
            </div>
          )}
          {n > 0 && <QueueList queue={queue} onMove={move} onRemove={remove} />}
        </main>
        <TmdbCredit />
      </div>

      <button
        ref={fabRef}
        className="fab"
        aria-label={n >= MAX ? "Queue full" : "Add a movie"}
        onClick={() => setSheetOpen(true)}
      >
        +
      </button>

      {sheetOpen && <SearchSheet queue={queue} onAdd={add} onClose={closeSheet} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}
