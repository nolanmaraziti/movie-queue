"use client";

import { useEffect, useRef, useState } from "react";
import type { Movie } from "@/lib/types";
import { fmtRun } from "@/lib/queue";
import Poster from "./Poster";

type Props = {
  queue: Movie[];
  onMove: (from: number, to: number, announce: boolean) => void;
  onRemove: (id: string) => void;
};

type Drag = { from: number; to: number; startY: number; rows: HTMLElement[]; row: HTMLElement; step: number; id: number };

const grip = (
  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <rect x="3" y="5" width="14" height="2" rx="1" />
    <rect x="3" y="9" width="14" height="2" rx="1" />
    <rect x="3" y="13" width="14" height="2" rx="1" />
  </svg>
);

export default function QueueList({ queue, onMove, onRemove }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useRef<Drag | null>(null);
  const focusAfter = useRef<number | null>(null);
  // Bumped after each drag so the rows are drawn fresh, without leftover drag offsets.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (focusAfter.current == null) return;
    listRef.current?.querySelector<HTMLElement>(`.handle[data-i="${focusAfter.current}"]`)?.focus();
    focusAfter.current = null;
  });

  // Drag to reorder: while dragging we slide the rows around directly,
  // then save the new order when the finger or mouse lets go.
  function onPointerDown(e: React.PointerEvent) {
    const h = (e.target as HTMLElement).closest<HTMLElement>(".handle");
    if (!h || e.button > 0 || !listRef.current) return;
    e.preventDefault();
    const rows = [...listRef.current.querySelectorAll<HTMLElement>("li.row")];
    const from = Number(h.dataset.i), row = rows[from];
    drag.current = { from, to: from, startY: e.clientY, rows, row, step: row.offsetHeight, id: e.pointerId };
    h.setPointerCapture(e.pointerId);
    row.classList.add("dragging");
    document.body.classList.add("is-dragging");
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const { from, rows, row, step } = d;
    let dy = e.clientY - d.startY;
    dy = Math.max(-from * step, Math.min((rows.length - 1 - from) * step, dy));
    row.style.transform = `translateY(${dy}px)`;
    const to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / step)));
    if (to !== d.to) {
      d.to = to;
      rows.forEach((r, i) => {
        if (i === from) return;
        let shift = 0;
        if (from < to && i > from && i <= to) shift = -step;
        if (from > to && i < from && i >= to) shift = step;
        r.style.transform = shift ? `translateY(${shift}px)` : "";
      });
      try { navigator.vibrate?.(8); } catch {}
    }
  }

  function endDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    document.body.classList.remove("is-dragging");
    setVersion((v) => v + 1);
    onMove(d.from, d.to, true);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const h = (e.target as HTMLElement).closest<HTMLElement>(".handle");
    if (!h) return;
    const i = Number(h.dataset.i);
    if (e.key === "ArrowUp" && i > 0) {
      e.preventDefault();
      focusAfter.current = i - 1;
      onMove(i, i - 1, false);
    }
    if (e.key === "ArrowDown" && i < queue.length - 1) {
      e.preventDefault();
      focusAfter.current = i + 1;
      onMove(i, i + 1, false);
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="label">Your queue</div>
      <ol
        ref={listRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        {queue.map((m, i) => (
          <li key={`${version}-${m.id}`} className={`row${i === 0 ? " first" : ""}`} data-i={i}>
            <button className="handle" data-i={i} aria-label={`Move ${m.title}. Use the up and down arrow keys.`}>
              {grip}
            </button>
            <span className="num">{i + 1}</span>
            <Poster movie={m} size="sm" />
            <div className="t">
              {i === 0 && <span className="chip">Up next</span>}
              <b>{m.title}</b>
              <small>{[m.year, fmtRun(m.runtime)].filter(Boolean).join(" · ")}</small>
            </div>
            <button className="x" onClick={() => onRemove(m.id)} aria-label={`Remove ${m.title}`}>
              ×
            </button>
          </li>
        ))}
      </ol>
      {queue.length > 1 && <div className="tip">Drag the handle on the left to change the order.</div>}
    </section>
  );
}
