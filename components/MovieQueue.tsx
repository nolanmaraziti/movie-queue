"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FriendQueue } from "@/lib/friends";
import type { GroupSummary, Invite } from "@/lib/groups";
import type { NightCard } from "@/lib/nights";
import type { Movie } from "@/lib/types";
import { MAX } from "@/lib/queue";
import Avatar from "./Avatar";
import GroupTile from "./GroupTile";
import { PlusIcon, SearchIcon } from "./icons";
import NightInviteCard from "./NightInviteCard";
import NightRow from "./NightRow";
import Poster from "./Poster";
import QueueList from "./QueueList";
import SearchSheet from "./SearchSheet";
import TabBar from "./TabBar";
import TmdbCredit from "./TmdbCredit";
import WheelSheet from "./WheelSheet";

type Props = {
  username: string;
  pending: number;
  nightCount: number;
  nightInvites: NightCard[];
  comingUp: NightCard[];
  initialQueue: Movie[];
  groups: GroupSummary[];
  invites: Invite[];
  friends: FriendQueue[];
};

// The home screen: your queue, group invites, your group queues, and what your friends are watching next.
export default function MovieQueue({ username, pending, nightCount, nightInvites, comingUp, initialQueue, groups, invites, friends }: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState<Movie[]>(initialQueue);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [today, setToday] = useState("");
  const [busy, setBusy] = useState("");
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
    // The date in your own time zone, like "Saturday, Oct 31".
    setToday(new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }));

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

  // The wheel's "Make it up next" button: move that movie to the top of the queue.
  function upNext(id: string) {
    const i = queue.findIndex((x) => x.id === id);
    if (i > 0) move(i, 0, true);
    setWheelOpen(false);
  }

  // Join or decline a group invite, right from the home screen.
  async function answer(id: string, method: "POST" | "DELETE") {
    setBusy(id);
    const res = await fetch(`/api/groups/${id}`, { method }).catch(() => null);
    if (res?.status === 401) return window.location.reload();
    if (!res?.ok) {
      toast("That didn't work. Try again.");
      return setBusy("");
    }
    if (method === "POST") return router.push(`/groups/${id}`);
    router.refresh();
    setBusy("");
  }

  const closeWheel = useCallback(() => setWheelOpen(false), []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    fabRef.current?.focus();
  }, []);

  const n = queue.length;
  const left = MAX - n;
  const upNextFriends = friends.filter((f) => f.queue.length > 0);

  return (
    <>
      <div className="app">
        <header>
          <div className="top">
            <div className="titles">
              <span className="label" suppressHydrationWarning>{today || " "}</span>
              <h1>Your queue</h1>
            </div>
            <Link className="round" href="/search" aria-label="Search movies and friends">
              <SearchIcon />
            </Link>
          </div>
          <div className="meter" aria-hidden="true">
            {Array.from({ length: MAX }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
          </div>
          <div className="sub">
            <span>{n} of {MAX} spots used</span>
            <span>{left === 0 ? "Full" : `${left} open`}</span>
          </div>
        </header>

        <div className="actions-row">
          <Link className="pill" href="/nights/new">Plan a night</Link>
          {n > 1 && <button className="pill ghost" onClick={() => setWheelOpen(true)}>Spin</button>}
          <Link className="pill outline-hot" href="/pick">Help me pick</Link>
        </div>

        <main className="home">
          {n === 0 ? (
            <div className="empty">
              <strong>Nothing queued</strong>
              <span>Tap + or an open spot to add a movie. You get ten spots.</span>
            </div>
          ) : (
            <QueueList queue={queue} onMove={move} onRemove={remove} />
          )}
          {left > 0 && (
            <div className="spots">
              {Array.from({ length: left }, (_, i) => (
                <button key={i} className="spot" onClick={() => setSheetOpen(true)} aria-label={`Add a movie to spot ${n + i + 1}`}>
                  Spot {n + i + 1}
                </button>
              ))}
            </div>
          )}

          {nightInvites.map((night) => <NightInviteCard key={night.token} night={night} />)}

          {comingUp.length > 0 && (
            <section className="block">
              <div className="list-head">
                <div className="label">Coming up</div>
                <Link className="link plain small" href="/nights">All nights</Link>
              </div>
              {comingUp.map((night) => <NightRow key={night.token} night={night} me={username} />)}
            </section>
          )}

          {invites.map((g) => (
            <section className="invite-card" key={g.id}>
              <div className="invite-top">
                <span className="tag">You&apos;re invited</span>
                {g.invitedBy && <span className="from">from @{g.invitedBy}</span>}
              </div>
              <div>
                <h2>{g.name}</h2>
                <small>
                  Group queue · {g.members.length} {g.members.length === 1 ? "member" : "members"}
                  {g.members.length > 0 && ` · ${g.members.slice(0, 3).map((m) => `@${m}`).join(", ")}${g.members.length > 3 ? "…" : ""}`}
                </small>
              </div>
              <div className="two">
                <button className="pill" disabled={busy === g.id} onClick={() => answer(g.id, "POST")}>Join</button>
                <button className="pill ghost" disabled={busy === g.id} onClick={() => answer(g.id, "DELETE")}>No thanks</button>
              </div>
            </section>
          ))}

          <section className="block">
            <h2 className="h2">Group queues</h2>
            <div className="gtiles">
              {groups.map((g) => <GroupTile key={g.id} group={g} />)}
              <Link className="gtile" href="/groups">
                <span className="mosaic new" aria-hidden="true"><PlusIcon size={30} />New group</span>
                <b className="muted">Start a group</b>
                <small>Invite friends to share</small>
              </Link>
            </div>
          </section>

          {upNextFriends.length > 0 && (
            <section className="block">
              <div className="label">Friends&apos; up next</div>
              <div className="fnext">
                {upNextFriends.map((f) => (
                  <Link key={f.username} href={`/u/${f.username}`} className="fnext-item">
                    <span className="fnext-pic">
                      <Avatar username={f.username} size={64} />
                      <span className="fnext-poster"><Poster movie={f.queue[0]} size="xs" /></span>
                    </span>
                    <b>@{f.username}</b>
                    <small>{f.queue[0].title}</small>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>
        <TmdbCredit />
      </div>

      <button
        ref={fabRef}
        className="fab"
        aria-label={n >= MAX ? "Queue full" : "Add a movie"}
        onClick={() => setSheetOpen(true)}
      >
        <PlusIcon size={28} />
      </button>

      <TabBar username={username} pending={pending} nights={nightCount} />

      {sheetOpen && <SearchSheet queue={queue} onAdd={add} onClose={closeSheet} />}
      {wheelOpen && <WheelSheet queue={queue} onUpNext={upNext} onClose={closeWheel} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}
