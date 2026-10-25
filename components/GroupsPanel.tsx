"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GroupSummary, Invite } from "@/lib/groups";
import Poster from "./Poster";

type Props = { groups: GroupSummary[]; invites: Invite[] };

// Start a new group queue, answer invites, and see the groups you're in.
export default function GroupsPanel({ groups, invites }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function call(url: string, method: "POST" | "DELETE", body?: object) {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) window.location.reload();
    if (!res.ok) throw new Error(data.error || "That didn't work. Try again.");
    return data;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    setError("");
    try {
      const { id } = await call("/api/groups", "POST", { name });
      router.push(`/groups/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setBusy("");
    }
  }

  // Accept uses POST and decline uses DELETE. Then the page reloads its lists.
  async function answer(id: string, method: "POST" | "DELETE") {
    setBusy(id);
    setError("");
    try {
      await call(`/api/groups/${id}`, method);
      if (method === "POST") return router.push(`/groups/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
    setBusy("");
  }

  const who = (members: string[]) =>
    members.length <= 3 ? members.map((m) => `@${m}`).join(", ") : `@${members[0]}, @${members[1]} and ${members.length - 2} more`;

  return (
    <div className="friends">
      <section>
        <div className="label">Start a group queue</div>
        <form className="newgroup" onSubmit={create}>
          <input
            className="field"
            placeholder="Name it, like “Friday movie night”"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="add big" disabled={!name.trim() || busy === "new"}>Create</button>
        </form>
        <div className="hint">You can invite your friends once it&apos;s made. Everyone in the group can add, move and remove movies.</div>
      </section>

      {error && <div className="full" role="alert">{error}</div>}

      {invites.length > 0 && (
        <section>
          <div className="label">Invites</div>
          {invites.map((g) => (
            <div className="res person" key={g.id}>
              <div className="t">
                <b>{g.name}</b>
                <small>{g.invitedBy ? `@${g.invitedBy} invited you` : "You're invited"} · {who(g.members)}</small>
              </div>
              <div className="actions">
                <button className="close" disabled={busy === g.id} onClick={() => answer(g.id, "DELETE")}>Decline</button>
                <button className="add" disabled={busy === g.id} onClick={() => answer(g.id, "POST")}>Join</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <div className="label">Your groups</div>
        {groups.length === 0 && <div className="hint">No groups yet. Name one above to start it.</div>}
        {groups.map((g) => (
          <Link className="res person friend group" key={g.id} href={`/groups/${g.id}`}>
            <span className="t">
              <b>{g.name}</b>
              <small>
                {g.queue.length} {g.queue.length === 1 ? "movie" : "movies"} · {g.members.length}{" "}
                {g.members.length === 1 ? "member" : "members"}
              </small>
            </span>
            {/* The group's posters in order, left to right. */}
            <span className="strip">
              {g.queue.map((m) => (
                <span key={m.id} title={m.title}>
                  <Poster movie={m} size="xs" />
                </span>
              ))}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
