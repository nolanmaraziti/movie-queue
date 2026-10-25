"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Movie } from "@/lib/types";
import { fmtRun, MAX } from "@/lib/queue";
import Nav from "./Nav";
import QueueList from "./QueueList";
import SearchSheet from "./SearchSheet";
import TmdbCredit from "./TmdbCredit";

type Props = { username: string; initialQueue: Movie[]; counts: { pending: number; invites: number } };

export default function MovieQueue({ username, initialQueue, counts }: Props) {
  const [queue, setQueue] = useState<Movie[]>(initialQueue);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fabRef = useRef<HTMLButtonElement>(null);
  const saving = useRef<Promise<unknown>>(Promise.resolve());

  // Save to your account on every change. Saves go out one at a time, in order,
  // so a slow save can never overwrite a newer one.
  function save(next: Movie[]) {
    saving.current = saving.current.then(async () => {
      try {
        const res = await fetch("/api/queue", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ queue: next }),
        });
        if (res.status === 401) return window.location.reload();
        if (!res.ok) throw new Error();
      } catch {
        toast("Couldn't save. Check your connection.");
      }
    });
  }

  function update(next: Movie[]) {
    setQueue(next);
    save(next);
  }

  useEffect(() => {
    // Fill in posters for TMDB movies saved without one (like the starter picks).
    for (const m of initialQueue) {
      if (!m.tmdbId || m.posterPath !== undefined) continue;
      fetch(`/api/movie/${m.tmdbId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.movie) return;
          setQueue((q) => {
            const next = q.map((x) => (x.id === m.id ? { ...x, ...data.movie } : x));
            save(next);
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
            <span>{(left === 0 ? "Queue full" : `${left} ${left === 1 ? "slot" : "slots"} open`)}</span>
            <span>{total ? `${fmtRun(total)} of movies` : ""}</span>
          </div>
          <Nav username={username} {...counts} />
        </header>
        <main>
          {n === 0 && (
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
