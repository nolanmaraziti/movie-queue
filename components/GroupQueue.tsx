"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Member } from "@/lib/groups";
import type { Movie } from "@/lib/types";
import { fmtRun, MAX } from "@/lib/queue";
import Nav from "./Nav";
import QueueList from "./QueueList";
import SearchSheet from "./SearchSheet";
import TmdbCredit from "./TmdbCredit";
import WheelSheet from "./WheelSheet";

type Props = {
  groupId: string;
  name: string;
  username: string;
  counts: { pending: number; invites: number };
  initialQueue: Movie[];
  members: Member[];
  invitable: string[];
};

type Change = { action: "add"; movie: Movie } | { action: "remove"; id: string } | { action: "move"; id: string; to: number };

// A queue shared by a group. It works like your own queue, but each change is sent
// to the server as "add this" or "move that", so everyone's changes are kept.
export default function GroupQueue({ groupId, name, username, counts, initialQueue, members, invitable }: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState<Movie[]>(initialQueue);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [busy, setBusy] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fabRef = useRef<HTMLButtonElement>(null);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const waiting = useRef(0);
  const base = `/api/groups/${groupId}`;

  function toast(msg: string) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 1800);
  }

  // Changes go out one at a time, in order. The server answers with the newest queue
  // (including anything the others just did), and that's what we show.
  function send(change: Change) {
    waiting.current++;
    saving.current = saving.current.then(async () => {
      try {
        const res = await fetch(`${base}/queue`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(change),
        });
        if (res.status === 401 || res.status === 403) return window.location.reload();
        const data = await res.json();
        if (data.error) toast(data.error);
        if (Array.isArray(data.queue) && waiting.current === 1) setQueue(data.queue);
      } catch {
        toast("Couldn't save. Check your connection.");
      } finally {
        waiting.current--;
      }
    });
  }

  // Pick up what the others added: every 15 seconds while the page is open, and when you come back to it.
  useEffect(() => {
    async function refresh() {
      if (document.hidden || waiting.current || document.body.classList.contains("is-dragging")) return;
      try {
        const res = await fetch(`${base}/queue`);
        if (res.status === 403) return window.location.reload();
        const data = await res.json();
        if (Array.isArray(data.queue) && !waiting.current) setQueue(data.queue);
      } catch {}
    }
    const t = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [base]);

  function move(from: number, to: number, announce: boolean) {
    if (to < 0 || to >= queue.length || from === to) return;
    const next = [...queue];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setQueue(next);
    send({ action: "move", id: m.id, to });
    if (announce) toast(to === 0 ? `“${m.title}” is up next` : `Moved “${m.title}” to #${to + 1}`);
  }

  function remove(id: string) {
    const m = queue.find((x) => x.id === id);
    setQueue(queue.filter((x) => x.id !== id));
    send({ action: "remove", id });
    if (m) toast(`Removed “${m.title}”`);
  }

  function add(m: Movie) {
    if (queue.length >= MAX) return toast("Queue is full");
    if (queue.some((x) => x.id === m.id)) return;
    const next = [...queue, { ...m, addedBy: username }];
    setQueue(next);
    send({ action: "add", movie: m });
    toast(next.length === MAX ? `Added “${m.title}”. Queue is full.` : `Added “${m.title}”`);
  }

  // Inviting, taking back an invite, and leaving. Then the page reloads its lists.
  async function act(key: string, url: string, method: "POST" | "DELETE", body?: object) {
    setBusy(key);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work. Try again.");
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "That didn't work. Try again.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function invite(u: string, method: "POST" | "DELETE") {
    if (await act(u, `${base}/invite`, method, { username: u })) {
      toast(method === "POST" ? `Invited @${u}` : `Took back @${u}'s invite`);
      router.refresh();
    }
  }

  async function leave() {
    const last = members.filter((m) => m.status === "joined").length === 1;
    const ask = last ? `You're the last one in “${name}”. Leave and delete it?` : `Leave “${name}”?`;
    if (confirm(ask) && (await act("leave", base, "DELETE"))) router.push("/groups");
  }

  // The wheel's "Make it up next" button: move that movie to the top of the queue.
  function upNext(id: string) {
    const i = queue.findIndex((x) => x.id === id);
    if (i > 0) move(i, 0, true);
    setWheelOpen(false);
  }

  const closeWheel = useCallback(() => setWheelOpen(false), []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    fabRef.current?.focus();
  }, []);

  const n = queue.length;
  const left = MAX - n;
  const total = queue.reduce((a, m) => a + (m.runtime || 0), 0);
  const joined = members.filter((m) => m.status === "joined");
  const invited = members.filter((m) => m.status === "invited");

  return (
    <>
      <div className="app">
        <header>
          <div className="top">
            <h1 className="gname">{name}</h1>
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
        <main className="friends">
          {n === 0 && (
            <div className="empty">
              <strong>Nothing queued</strong>
              <span>Tap + to add a movie. Everyone in the group shares these ten slots.</span>
            </div>
          )}
          {n > 0 && <QueueList queue={queue} label="Group queue" onMove={move} onRemove={remove} onSpin={() => setWheelOpen(true)} />}

          <section>
            <div className="label">In this group</div>
            {joined.map((m) => (
              <div className="res person" key={m.username}>
                <div className="t"><b>@{m.username}</b>{m.username === username && <small>you</small>}</div>
                {m.username === username && (
                  <button className="close" disabled={busy === "leave"} onClick={leave}>Leave</button>
                )}
              </div>
            ))}
            {invited.map((m) => (
              <div className="res person" key={m.username}>
                <div className="t"><b>@{m.username}</b><small>invited, hasn&apos;t joined yet</small></div>
                <button className="close" disabled={busy === m.username} onClick={() => invite(m.username, "DELETE")}>Cancel</button>
              </div>
            ))}
          </section>

          <section>
            <div className="label">Invite friends</div>
            {invitable.length === 0 && (
              <div className="hint">No friends left to invite. Friends you add on the Friends page show up here.</div>
            )}
            {invitable.map((u) => (
              <div className="res person" key={u}>
                <div className="t"><b>@{u}</b></div>
                <button className="add" disabled={busy === u} onClick={() => invite(u, "POST")}>Invite</button>
              </div>
            ))}
          </section>
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
      {wheelOpen && <WheelSheet queue={queue} onUpNext={upNext} onClose={closeWheel} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}
