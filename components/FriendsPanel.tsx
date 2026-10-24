"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FriendStatus, Person } from "@/lib/friends";

type Friend = { username: string; count: number; common: number };
type Props = { friends: Friend[]; received: string[]; sent: string[] };

// Find people by username, answer friend requests, and see your friends.
export default function FriendsPanel({ friends, received, sent }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const term = q.trim();

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

  // Add / accept use POST, and decline / cancel / unfriend use DELETE. Then the page reloads its lists.
  async function act(username: string, method: "POST" | "DELETE") {
    setBusy(username);
    setError("");
    try {
      const res = await fetch("/api/friends", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work. Try again.");
      const status: FriendStatus = data.status;
      setResults((r) => r.map((p) => (p.username === username ? { ...p, status } : p)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
    setBusy("");
  }

  function button(p: Person) {
    const off = busy === p.username;
    if (p.status === "friends") return <Link className="add" href={`/u/${p.username}`}>View queue</Link>;
    if (p.status === "received") return <button className="add" disabled={off} onClick={() => act(p.username, "POST")}>Accept</button>;
    if (p.status === "sent") return <button className="add" disabled>Requested</button>;
    return <button className="add" disabled={off} onClick={() => act(p.username, "POST")}>Add friend</button>;
  }

  return (
    <div className="friends">
      <section>
        <div className="label">Find people</div>
        <input
          className="field"
          type="search"
          placeholder="Search by username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div aria-live="polite">
          {term && !searching && results.length === 0 && <div className="hint">No one with a username starting “{term}”.</div>}
          {results.map((p) => (
            <div className="res person" key={p.username}>
              <div className="t"><b>@{p.username}</b></div>
              {button(p)}
            </div>
          ))}
        </div>
      </section>

      {error && <div className="full" role="alert">{error}</div>}

      {received.length > 0 && (
        <section>
          <div className="label">Friend requests</div>
          {received.map((u) => (
            <div className="res person" key={u}>
              <div className="t"><b>@{u}</b><small>wants to be friends</small></div>
              <div className="actions">
                <button className="close" disabled={busy === u} onClick={() => act(u, "DELETE")}>Decline</button>
                <button className="add" disabled={busy === u} onClick={() => act(u, "POST")}>Accept</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <div className="label">Friends</div>
        {friends.length === 0 && <div className="hint">No friends yet. Search for someone above and send a request.</div>}
        {friends.map((f) => (
          <div className="res person" key={f.username}>
            <Link className="t" href={`/u/${f.username}`}>
              <b>@{f.username}</b>
              <small>
                {f.count} {f.count === 1 ? "movie" : "movies"} queued
                {f.common > 0 && <> · <span className="common">{f.common} in common</span></>}
              </small>
            </Link>
            <div className="actions">
              <button
                className="x"
                aria-label={`Unfriend ${f.username}`}
                disabled={busy === f.username}
                onClick={() => confirm(`Unfriend @${f.username}?`) && act(f.username, "DELETE")}
              >
                ×
              </button>
              <Link className="add" href={`/u/${f.username}`}>View</Link>
            </div>
          </div>
        ))}
      </section>

      {sent.length > 0 && (
        <section>
          <div className="label">Waiting for them to accept</div>
          {sent.map((u) => (
            <div className="res person" key={u}>
              <div className="t"><b>@{u}</b></div>
              <button className="close" disabled={busy === u} onClick={() => act(u, "DELETE")}>Cancel</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
