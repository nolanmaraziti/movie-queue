"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FriendQueue, FriendStatus, Person } from "@/lib/friends";
import { MAX } from "@/lib/queue";
import Avatar from "./Avatar";
import { SearchIcon, XIcon } from "./icons";
import Poster from "./Poster";
import ShareButton from "./ShareButton";

type Props = {
  username: string;
  friends: FriendQueue[];
  requests: { username: string; mutual: number }[];
  sent: string[];
  myIds: string[];
};

// The Friends tab: share your link, add people by username, answer requests, and see everyone's queues.
export default function FriendsPanel({ username, friends, requests, sent, myIds }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const term = q.trim();
  const mine = new Set(myIds);

  useEffect(() => {
    if (!term) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = await res.json();
        if (res.ok) setResults(data.results);
      } catch {}
      if (!ctrl.signal.aborted) setSearching(false);
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  // Add / accept use POST, and decline / cancel use DELETE. Then the page reloads its lists.
  async function act(who: string, method: "POST" | "DELETE") {
    setBusy(who);
    setError("");
    try {
      const res = await fetch("/api/friends", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: who }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work. Try again.");
      const status: FriendStatus = data.status;
      setResults((r) => r.map((p) => (p.username === who ? { ...p, status } : p)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
    setBusy("");
  }

  function button(p: Person) {
    const off = busy === p.username;
    if (p.status === "friends") return <Link className="add" href={`/u/${p.username}`}>View</Link>;
    if (p.status === "received") return <button className="add" disabled={off} onClick={() => act(p.username, "POST")}>Accept</button>;
    if (p.status === "sent") return <button className="add" disabled>Requested</button>;
    return <button className="add" disabled={off} onClick={() => act(p.username, "POST")}>Add friend</button>;
  }

  return (
    <div className="friends">
      <div className="top">
        <h1>Friends</h1>
        <ShareButton username={username} label="Share my link" className="pill hot" />
      </div>

      <label className="searchbox">
        <span className="sr">Add friends by username</span>
        <SearchIcon size={18} />
        <input
          type="search"
          placeholder="Add friends by username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {term && (
        <div aria-live="polite">
          {!searching && results.length === 0 && <div className="hint">No one with a username starting “{term}”.</div>}
          {results.map((p) => (
            <div className="res person" key={p.username}>
              <Link className="who" href={`/u/${p.username}`}>
                <Avatar username={p.username} size={36} />
                <b>@{p.username}</b>
              </Link>
              {button(p)}
            </div>
          ))}
        </div>
      )}

      {error && <div className="full" role="alert">{error}</div>}

      {requests.length > 0 && (
        <section>
          <div className="label">Friend requests · {requests.length}</div>
          {requests.map((r) => (
            <div className="req" key={r.username}>
              <Link className="who" href={`/u/${r.username}`}>
                <Avatar username={r.username} size={44} />
                <span className="t">
                  <b>@{r.username}</b>
                  <small>{r.mutual > 0 ? `${r.mutual} ${r.mutual === 1 ? "friend" : "friends"} in common` : "wants to be friends"}</small>
                </span>
              </Link>
              <div className="actions">
                <button className="add" disabled={busy === r.username} onClick={() => act(r.username, "POST")}>Accept</button>
                <button className="x" aria-label={`Decline @${r.username}`} disabled={busy === r.username} onClick={() => act(r.username, "DELETE")}>
                  <XIcon />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <div className="list-head">
          <div className="label">Their queues · {friends.length} {friends.length === 1 ? "friend" : "friends"}</div>
          {friends.length > 1 && <span className="tip">Recently changed first</span>}
        </div>
        {friends.length === 0 && (
          <div className="hint">No friends yet. Search for someone above, or share your link so they can add you.</div>
        )}
        {friends.map((f) => {
          const common = f.queue.filter((m) => mine.has(m.id)).length;
          const n = f.queue.length;
          return (
            <div className="fcard" key={f.username}>
              <Link className="fcard-head" href={`/u/${f.username}`}>
                <Avatar username={f.username} size={44} />
                <span className="t">
                  <b>@{f.username}</b>
                  <small>
                    {n === 0 ? "Nothing queued yet" : `Up next: ${f.queue[0].title} · ${n} of ${MAX}${n === MAX ? ", full" : ""}`}
                  </small>
                </span>
                {common > 0 && <span className="incommon">{common} in common</span>}
              </Link>
              {n > 0 && (
                // Their queue's posters in order. Ones that are in your queue too get a blue ring.
                <Link className="fstrip" href={`/u/${f.username}`} aria-label={`See @${f.username}'s queue`}>
                  {f.queue.map((m, i) => (
                    <span key={m.id} className={mine.has(m.id) ? "both" : undefined} title={m.title}>
                      <Poster movie={m} size="sm" />
                      <i>{i + 1}</i>
                    </span>
                  ))}
                </Link>
              )}
            </div>
          );
        })}
        {friends.length > 0 && (
          <div className="tip">Tap a friend to see their whole queue. Movies with a blue ring are in your queue too.</div>
        )}
      </section>

      {sent.length > 0 && (
        <section>
          <div className="label">Waiting for them to accept</div>
          {sent.map((u) => (
            <div className="res person" key={u}>
              <Link className="who" href={`/u/${u}`}>
                <Avatar username={u} size={36} />
                <b>@{u}</b>
              </Link>
              <button className="close" disabled={busy === u} onClick={() => act(u, "DELETE")}>Cancel</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
