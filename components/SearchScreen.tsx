"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FriendStatus, Person } from "@/lib/friends";
import type { GroupSummary } from "@/lib/groups";
import { fmtRun, MAX, slug } from "@/lib/queue";
import type { Movie } from "@/lib/types";
import Avatar from "./Avatar";
import { GroupRow } from "./GroupTile";
import { PlusIcon, SearchIcon } from "./icons";
import Poster from "./Poster";
import TmdbCredit from "./TmdbCredit";

type Tab = "movies" | "people" | "friends" | "groups";
type CastCrew = { id: number; name: string; job: string; movies: Movie[] };
type Props = {
  initialQueue: Movie[];
  inFriends: Record<string, string[]>;
  popular: { movie: Movie; count: number }[];
  groups: GroupSummary[];
};

const TABS: { id: Tab; label: string; placeholder: string }[] = [
  { id: "movies", label: "Movies", placeholder: "Search movies" },
  { id: "people", label: "Cast & crew", placeholder: "Search actors and directors" },
  { id: "friends", label: "Friends", placeholder: "Search people by username" },
  { id: "groups", label: "Groups", placeholder: "Search your groups" },
];

const RECENT_KEY = "mq-recent-searches";

function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
}

// One search screen for movies, cast and crew, people to friend, and your groups.
export default function SearchScreen({ initialQueue, inFriends, popular, groups }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("movies");
  const [q, setQ] = useState("");
  const [queue, setQueue] = useState(initialQueue);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [people, setPeople] = useState<CastCrew[]>([]);
  const [users, setUsers] = useState<Person[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState("");
  const [busy, setBusy] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = q.trim();

  useEffect(() => {
    setRecent(loadRecent());
    inputRef.current?.focus();
  }, []);

  // Search as you type, waiting until typing pauses. Groups are filtered right here, no server needed.
  useEffect(() => {
    if (!term || tab === "groups") {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const ctrl = new AbortController();
    const url = {
      movies: `/api/search?q=${encodeURIComponent(term)}`,
      people: `/api/search/people?q=${encodeURIComponent(term)}`,
      friends: `/api/users/search?q=${encodeURIComponent(term)}`,
    }[tab];
    const t = setTimeout(async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed.");
        if (tab === "movies") setMovies(data.results);
        if (tab === "people") setPeople(data.results);
        if (tab === "friends") setUsers(data.results);
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
  }, [term, tab]);

  function toast(msg: string) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 1800);
  }

  function remember() {
    if (!term) return;
    const next = [term, ...recent.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(0, 6);
    setRecent(next);
    saveRecent(next);
  }

  async function add(m: Movie) {
    if (queue.length >= MAX) return toast("Your queue is full");
    remember();
    setBusy(m.id);
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ movie: m }),
      });
      if (res.status === 401) return window.location.reload();
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.queue)) setQueue(data.queue);
      if (!res.ok) throw new Error(data.error || "Couldn't add it. Try again.");
      toast(data.queue.length === MAX ? `Added “${m.title}”. Queue is full.` : `Added “${m.title}”`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't add it. Try again.");
    }
    setBusy("");
  }

  async function friend(username: string) {
    setBusy(username);
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) {
      const s: FriendStatus = data.status;
      setUsers((list) => list.map((p) => (p.username === username ? { ...p, status: s } : p)));
      remember();
    } else toast("That didn't work. Try again.");
    setBusy("");
  }

  const position = (id: string) => queue.findIndex((m) => m.id === id);
  const full = queue.length >= MAX;

  function movieRow(m: Movie, note?: string) {
    const at = position(m.id);
    const who = inFriends[m.id];
    const sub = note ?? [m.year, fmtRun(m.runtime), who && `In ${who.length === 1 ? `@${who[0]}'s` : `${who.length} friends'`} queue`]
      .filter(Boolean)
      .join(" · ");
    return (
      <div className="sres" key={m.id}>
        <Poster movie={m} size="sm" />
        {m.tmdbId ? (
          <Link className="t plainlink" href={`/movie/${m.tmdbId}`}>
            <b>{m.title} {m.year && <span className="yr">{m.year}</span>}</b>
            {sub && <small>{sub}</small>}
          </Link>
        ) : (
          <div className="t">
            <b>{m.title} {m.year && <span className="yr">{m.year}</span>}</b>
            {sub && <small>{sub}</small>}
          </div>
        )}
        {at >= 0 ? (
          <span className="pos" aria-label={`Number ${at + 1} in your queue`}>#{at + 1}</span>
        ) : (
          <button className="addround" disabled={busy === m.id || full} onClick={() => add(m)} aria-label={`Add ${m.title} to your queue`}>
            <PlusIcon size={18} />
          </button>
        )}
      </div>
    );
  }

  const matchingGroups = groups.filter((g) => g.name.toLowerCase().includes(term.toLowerCase()));
  const placeholder = TABS.find((t) => t.id === tab)!.placeholder;

  return (
    <>
      <div className="app search">
        <div className="search-top">
          <label className="searchbox">
            <span className="sr">Search</span>
            <SearchIcon size={18} />
            <input
              ref={inputRef}
              type="search"
              placeholder={placeholder}
              autoComplete="off"
              autoCapitalize={tab === "friends" ? "none" : undefined}
              spellCheck={tab === "friends" ? false : undefined}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && remember()}
            />
          </label>
          <button className="link plain" onClick={() => (history.length > 1 ? router.back() : router.push("/"))}>Cancel</button>
        </div>

        <div className="segs" role="tablist" aria-label="What to search">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {full && tab !== "friends" && tab !== "groups" && (
          <div className="full">Your queue is full. Remove a movie to make room for a new one.</div>
        )}

        {!term && (
          <>
            {recent.length > 0 && (
              <section className="block">
                <div className="list-head">
                  <div className="label">Recent searches</div>
                  <button className="link plain" onClick={() => { setRecent([]); saveRecent([]); }}>Clear</button>
                </div>
                <div className="chips">
                  {recent.map((r) => <button key={r} className="chipbtn" onClick={() => setQ(r)}>{r}</button>)}
                </div>
              </section>
            )}
            {popular.length > 0 && (tab === "movies" || tab === "people") && (
              <section className="block">
                <div className="label">Popular with your friends</div>
                <div className="hscroll">
                  {popular.map(({ movie, count }) => {
                    const at = position(movie.id);
                    return (
                      <div className="pop" key={movie.id}>
                        <Poster movie={movie} size="md" />
                        <b>{movie.title}</b>
                        <small>{count} {count === 1 ? "friend" : "friends"}</small>
                        {at >= 0 ? (
                          <span className="pos">#{at + 1}</span>
                        ) : (
                          <button className="addround sm" disabled={busy === movie.id || full} onClick={() => add(movie)} aria-label={`Add ${movie.title} to your queue`}>
                            <PlusIcon size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            {tab === "groups" && (
              <section className="block">
                <div className="label">Your groups</div>
                {groups.length === 0 && <div className="hint">You&apos;re not in any groups yet.</div>}
                {groups.map((g) => <GroupRow key={g.id} group={g} />)}
              </section>
            )}
            {tab === "friends" && <div className="hint">Type a username to find someone and send a friend request.</div>}
          </>
        )}

        {term && (
          <div className="results-list" aria-live="polite">
            {status === "loading" && <div className="hint">Searching…</div>}
            {status === "error" && <div className="hint">{error}</div>}

            {tab === "movies" && status === "done" && (
              <>
                {movies.map((m) => movieRow(m))}
                {movieRow({ id: "custom-" + slug(term), title: term, year: "", runtime: 0 }, movies.length ? "Not the one? Add it as typed" : "No match on TMDB. Add it as typed")}
              </>
            )}

            {tab === "people" && status === "done" && (
              <>
                {people.length === 0 && <div className="hint">No actors or filmmakers named “{term}”.</div>}
                {people.map((p) => (
                  <section className="person-block" key={p.id}>
                    <div className="label">{p.name}{p.job && ` · ${p.job}`}</div>
                    {p.movies.map((m) => movieRow(m))}
                  </section>
                ))}
              </>
            )}

            {tab === "friends" && status === "done" && (
              <>
                {users.length === 0 && <div className="hint">No one with a username starting “{term}”.</div>}
                {users.map((p) => (
                  <div className="res person" key={p.username}>
                    <Link className="who" href={`/u/${p.username}`}>
                      <Avatar username={p.username} size={36} />
                      <b>@{p.username}</b>
                    </Link>
                    {p.status === "friends" ? (
                      <Link className="add" href={`/u/${p.username}`}>View</Link>
                    ) : p.status === "sent" ? (
                      <button className="add" disabled>Requested</button>
                    ) : (
                      <button className="add" disabled={busy === p.username} onClick={() => friend(p.username)}>
                        {p.status === "received" ? "Accept" : "Add friend"}
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}

            {tab === "groups" && (
              <>
                {matchingGroups.length === 0 && <div className="hint">None of your groups match “{term}”.</div>}
                {matchingGroups.map((g) => <GroupRow key={g.id} group={g} />)}
              </>
            )}
          </div>
        )}
        <TmdbCredit />
      </div>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}
