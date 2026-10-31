"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { shortDay, time } from "@/lib/when";
import Avatar from "./Avatar";
import { kindLabel } from "./NightRow";
import TmdbCredit from "./TmdbCredit";

type Answer = "going" | "maybe" | "no";
type Props = {
  token: string;
  host: string;
  title: string;
  kind: string;
  startsAt: string;
  tz: string;
  place: string;
  address: string;
  note: string;
  going: string[];
  goingCount: number;
  maybeCount: number;
  answered: { name: string; rsvp: Answer } | null;
};

const LABELS: [Answer, string][] = [["going", "Going"], ["maybe", "Maybe"], ["no", "Can't go"]];

// What an invite link shows to someone without an account: the basics, and a way to answer with just a name.
export default function GuestInvite(p: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function answer(rsvp: Answer) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/nights/${p.token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "rsvp", rsvp, name, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work. Try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
    setBusy(false);
  }

  const counts = [`${p.goingCount} going`, p.maybeCount ? `${p.maybeCount} maybe` : ""].filter(Boolean).join(", ");

  return (
    <div className="app guest-page">
      <header className={`night-hero ${p.kind}`}>
        <div>
          <span className="kind">@{p.host} invited you · {kindLabel(p.kind)}</span>
          <h1>{p.title}</h1>
          <span className="note">{[shortDay(p.startsAt, p.tz), time(p.startsAt, p.tz), p.place].filter(Boolean).join(" · ")}</span>
          {p.address && <span className="note">{p.address}</span>}
          {p.note && <span className="note">{p.note}</span>}
        </div>
      </header>

      <div className="faces-line">
        <span className="faces">{p.going.slice(0, 5).map((u) => <Avatar key={u} username={u} size={28} />)}</span>
        <small>{counts}</small>
      </div>

      <section className="card">
        {p.answered ? (
          <>
            <b>Thanks, {p.answered.name}!</b>
            <small className="muted">
              You said {p.answered.rsvp === "no" ? "you can't go" : p.answered.rsvp === "maybe" ? "maybe" : "you're going"}. Changed your mind?
            </small>
          </>
        ) : (
          <>
            <b>Are you coming?</b>
            <small className="muted">No account needed.</small>
            <label>
              <span className="label">Your name</span>
              <input className="field" maxLength={40} autoComplete="given-name" placeholder="First name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              <span className="label">Phone number</span>
              <input className="field" type="tel" maxLength={20} autoComplete="tel" placeholder={`Optional, so @${p.host} can text updates`} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </>
        )}
        <div className="rsvp">
          {LABELS.map(([value, label]) => (
            <button key={value} aria-pressed={p.answered?.rsvp === value} disabled={busy || (!p.answered && !name.trim())} onClick={() => answer(value)}>
              {label}
            </button>
          ))}
        </div>
        {error && <div className="hint" role="alert">{error}</div>}
      </section>

      <section className="card soft">
        <b>Vote on the movie and see the full guest list</b>
        <small className="muted">Get Movie Queue to vote, write on the wall, and keep your own 10-movie queue.</small>
        <Link className="pill" href={`/n/${p.token}?join=1`}>Log in or sign up</Link>
      </section>
      <TmdbCredit />
    </div>
  );
}
