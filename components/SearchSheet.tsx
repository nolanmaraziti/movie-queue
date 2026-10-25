"use client";

import { useEffect, useRef, useState } from "react";
import type { Movie } from "@/lib/types";
import { fmtRun, MAX, slug } from "@/lib/queue";
import Poster from "./Poster";

type Props = {
  queue: Movie[];
  onAdd: (m: Movie) => void;
  onClose: () => void;
};

type Status = "idle" | "loading" | "done" | "error";

export default function SearchSheet({ queue, onAdd, onClose }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const full = queue.length >= MAX;
  const inQ = new Set(queue.map((m) => m.id));
  const term = q.trim();

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Ask our own server (/api/search) to search TMDB, waiting until typing pauses.
  useEffect(() => {
    if (!term) {
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed.");
        setResults(data.results);
        setStatus("done");
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Search failed.");
        setStatus("error");
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  function addTyped() {
    if (term) onAdd({ id: "custom-" + slug(term), title: term, year: "", runtime: 0 });
  }

  function onEnter(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || full) return;
    const first = results.find((m) => !inQ.has(m.id));
    if (status === "done" && first) onAdd(first);
    else if (status === "done" || status === "error") addTyped();
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
        <div className="sheet-in">
          <div className="sheet-head">
            <h3 id="sheetTitle">Add a movie</h3>
            <button className="close" onClick={onClose}>Done</button>
          </div>
          {full && <div className="full">This queue is full. Remove a movie to make room for a new one.</div>}
          <input
            ref={inputRef}
            id="q"
            type="search"
            placeholder="Search movies"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onEnter}
          />
          <div className="results" aria-live="polite">
            {status === "idle" && <div className="hint">Start typing a title, like “Dune” or “Totoro”.</div>}
            {status === "loading" && results.length === 0 && <div className="hint">Searching…</div>}
            {status === "error" && <div className="hint">{error}</div>}
            {status !== "error" &&
              results.map((m) => {
                const added = inQ.has(m.id);
                return (
                  <div className="res" key={m.id}>
                    <Poster movie={m} size="sm" />
                    <div className="t">
                      <b>{m.title}</b>
                      <small>{[m.year, fmtRun(m.runtime)].filter(Boolean).join(" · ")}</small>
                    </div>
                    <button className="add" disabled={added || full} onClick={() => onAdd(m)}>
                      {added ? "In queue" : "Add"}
                    </button>
                  </div>
                );
              })}
            {term && status !== "loading" && (
              <div className="res">
                <div />
                <div className="t">
                  <b>{status === "done" && results.length ? "Not the one?" : "No match on TMDB"}</b>
                  <small>Add “{term}” as typed</small>
                </div>
                <button className="add" disabled={full} onClick={addTyped}>Add</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
