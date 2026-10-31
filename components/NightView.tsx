"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { Night, Post, Rsvp } from "@/lib/nights";
import type { Movie } from "@/lib/types";
import { fmtRun } from "@/lib/queue";
import { fullDay, time } from "@/lib/when";
import Avatar from "./Avatar";
import { BackIcon } from "./icons";
import { kindLabel } from "./NightRow";
import Poster from "./Poster";
import RsvpButtons from "./RsvpButtons";
import ShareButton from "./ShareButton";
import TmdbCredit from "./TmdbCredit";
import WheelSheet from "./WheelSheet";

type Props = {
  me: string;
  isHost: boolean;
  isGuest: boolean;
  justMade: boolean;
  night: Night;
  hasAddress: boolean;
  myRsvp: Rsvp | null;
  myVote: string | null;
  guests: { username: string; rsvp: Rsvp; vote: string | null }[];
  visitors: { name: string; rsvp: string; phone: string }[];
  goingCount: number;
  maybeCount: number;
  wall: Post[];
  wheelQueue: Movie[];
};

// Builds a calendar file for "Add to calendar". It lasts as long as the movie plus half an hour.
function calendarFile(night: Night) {
  const start = new Date(night.startsAt);
  const minutes = (night.movie?.runtime || 120) + 30;
  const end = new Date(start.getTime() + minutes * 60e3);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Movie Queue//EN", "BEGIN:VEVENT",
    `UID:${night.token}@moviequeue`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(night.title)}`,
    `LOCATION:${esc([night.place, night.address].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc([night.movie && `Watching ${night.movie.title}`, night.note, `${window.location.origin}/n/${night.token}`].filter(Boolean).join("\n"))}`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "movie-night.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function NightView(p: Props) {
  const { night } = p;
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [post, setPost] = useState("");
  const [wheelOpen, setWheelOpen] = useState(false);
  const started = new Date(night.startsAt).getTime() < Date.now();

  async function act(key: string, body: object, method: "POST" | "DELETE" = "POST") {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(`/api/nights/${night.token}`, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) return window.location.reload();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work. Try again.");
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function cancel() {
    if (!confirm(`Cancel “${night.title}”? Everyone invited loses the invite.`)) return;
    if (await act("cancel", {}, "DELETE")) router.push("/nights");
  }

  async function sendPost(e: React.FormEvent) {
    e.preventDefault();
    if (await act("post", { action: "post", body: post })) setPost("");
  }

  const pickFromWheel = useCallback(
    async (id: string) => {
      setWheelOpen(false);
      await act("pick", { action: "pick", movieId: id });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const closeWheel = useCallback(() => setWheelOpen(false), []);

  // Vote counts for each choice, from everyone's single vote.
  const votes = night.options.map((m) => ({ movie: m, n: p.guests.filter((g) => g.vote === m.id).length }));
  const totalVotes = votes.reduce((a, v) => a + v.n, 0);
  const leader = votes.reduce<(typeof votes)[number] | null>((best, v) => (v.n > (best?.n ?? 0) ? v : best), null);
  const coming = [
    ...p.guests.filter((g) => g.rsvp === "going" || g.rsvp === "maybe").map((g) => ({ key: g.username, name: g.username, rsvp: g.rsvp, user: true, phone: "" })),
    ...p.visitors.filter((v) => v.rsvp !== "no").map((v, i) => ({ key: `v${i}`, name: v.name, rsvp: v.rsvp, user: false, phone: v.phone })),
  ];
  const waiting = p.guests.filter((g) => g.rsvp === "pending").length;
  const cant = p.guests.filter((g) => g.rsvp === "no").length + p.visitors.filter((v) => v.rsvp === "no").length;

  return (
    <>
      <div className="app night-page">
        <div className="bar">
          <Link className="round" href="/nights" aria-label="Back to movie nights"><BackIcon /></Link>
          <ShareButton path={`/n/${night.token}`} text={`You're invited: ${night.title}`} label="Share link" className="pill ghost" />
        </div>

        {p.justMade && (
          <div className="made">
            <b>Your night is set.</b>
            <span>Friends you picked got an invite. Send the link to anyone else. They can answer without an account.</span>
            <ShareButton path={`/n/${night.token}`} text={`You're invited: ${night.title}`} label="Copy invite link" className="pill hot" />
          </div>
        )}

        <header className={`night-hero ${night.kind}`}>
          <div>
            <span className="kind">{kindLabel(night.kind)}</span>
            <h1>{night.title}</h1>
            {night.note && <span className="note">{night.note}</span>}
          </div>
          {night.movie && <Poster movie={night.movie} size="md" />}
        </header>

        <section className="facts">
          <div><b>{fullDay(night.startsAt, night.tz)}</b><small>{time(night.startsAt, night.tz)}{night.movie?.runtime ? ` · ${fmtRun(night.movie.runtime)} movie` : ""}</small></div>
          {(night.place || p.hasAddress) && (
            <div>
              <b>{night.place || "Location"}</b>
              <small>{night.address || (p.hasAddress ? "Address shows once you say you're going" : "")}</small>
            </div>
          )}
          <div className="host">
            <Avatar username={night.host} size={32} />
            <span><b>Hosted by {p.isHost ? "you" : `@${night.host}`}</b>{night.groupName && <small>For {night.groupName}</small>}</span>
          </div>
        </section>

        <section className="card">
          {p.isHost ? (
            <>
              <b>You&apos;re hosting</b>
              <small className="muted">{p.goingCount} going{p.maybeCount ? `, ${p.maybeCount} maybe` : ""}{waiting ? `, ${waiting} haven't answered` : ""}{cant ? `, ${cant} can't` : ""}</small>
            </>
          ) : (
            <>
              <b>{p.myRsvp && p.myRsvp !== "pending" ? "Your answer" : "Are you coming?"}</b>
              <RsvpButtons token={night.token} current={p.myRsvp ?? undefined} />
            </>
          )}
          <button className="pill ghost" onClick={() => calendarFile(night)}>Add to calendar</button>
        </section>

        {error && <div className="full" role="alert">{error}</div>}

        <section className="block">
          {night.movie ? (
            <>
              <div className="label">The movie</div>
              <div className="picked">
                <Poster movie={night.movie} size="sm" />
                <span className="t"><b>{night.movie.title}</b><small>{[night.movie.year, fmtRun(night.movie.runtime)].filter(Boolean).join(" · ")}</small></span>
                {p.isHost && night.pickMode !== "upnext" && !started && (
                  <button className="link plain" disabled={busy === "pick"} onClick={() => act("pick", { action: "pick", movieId: null })}>Change</button>
                )}
              </div>
            </>
          ) : night.pickMode === "vote" ? (
            <>
              <div className="list-head">
                <div className="label">Vote on the movie</div>
                <small className="tip">{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</small>
              </div>
              {votes.map(({ movie, n }) => {
                const mineVote = p.myVote === movie.id;
                const pct = totalVotes ? Math.round((n / totalVotes) * 100) : 0;
                return (
                  <div key={movie.id} className={`vote${mineVote ? " mine" : ""}`}>
                    <button
                      className="vote-main"
                      disabled={!p.isGuest || busy === "vote"}
                      onClick={() => act("vote", { action: "vote", movieId: mineVote ? null : movie.id })}
                      aria-pressed={mineVote}
                      aria-label={`${mineVote ? "Take back your vote for" : "Vote for"} ${movie.title}`}
                    >
                      <Poster movie={movie} size="sm" />
                      <span className="t">
                        <b>{movie.title}</b>
                        <span className="bar-track"><span style={{ width: `${pct}%` }} /></span>
                      </span>
                      <span className="vcount">{n} {n === 1 ? "vote" : "votes"}</span>
                    </button>
                    {p.isHost && (
                      <button className="link plain" disabled={busy === "pick"} onClick={() => act("pick", { action: "pick", movieId: movie.id })}>Pick</button>
                    )}
                  </div>
                );
              })}
              <small className="tip">
                {p.isGuest
                  ? `Tap a movie to vote${p.myVote ? ", tap it again to take it back" : ""}. `
                  : "Answer the invite to vote. "}
                The top {votes.length} from {night.groupName ?? `@${night.host}'s queue`}.
                {p.isHost && (leader ? ` Tap Pick to lock one in. “${leader.movie.title}” is winning.` : " Tap Pick to lock one in.")}
              </small>
            </>
          ) : (
            <>
              <div className="label">The movie</div>
              <div className="hint">
                {p.isHost
                  ? `It'll be a surprise from ${night.groupName ?? "your queue"}. Spin the wheel when everyone's there.`
                  : `@${night.host} will spin the wheel on the night.`}
              </div>
              {p.isHost && p.wheelQueue.length > 0 && (
                <button className="pill" onClick={() => setWheelOpen(true)}>Spin the wheel</button>
              )}
              {p.isHost && p.wheelQueue.length === 0 && <div className="hint">The queue is empty, so add a movie first.</div>}
            </>
          )}
        </section>

        <section className="block">
          <div className="list-head">
            <div className="label">Who&apos;s coming</div>
            <small className="tip">{p.goingCount} going{p.maybeCount ? ` · ${p.maybeCount} maybe` : ""}</small>
          </div>
          {coming.length === 0 && <div className="hint">No one has answered yet.</div>}
          <div className="guests">
            {coming.map((g) => {
              const label = g.user ? (g.name === p.me ? "You" : `@${g.name}`) : g.name;
              const inner = (
                <>
                  <span className={`ring ${g.rsvp}`}><Avatar username={g.name} size={48} /></span>
                  <small>{label}</small>
                  {g.rsvp === "maybe" && <small className="muted">maybe</small>}
                  {g.phone && <small className="muted phone">{g.phone}</small>}
                </>
              );
              return g.user && g.name !== p.me ? (
                <Link key={g.key} href={`/u/${g.name}`} className="guest">{inner}</Link>
              ) : (
                <span key={g.key} className="guest">{inner}</span>
              );
            })}
          </div>
          {p.isHost && p.visitors.some((v) => v.phone) && <small className="tip">Only you can see phone numbers.</small>}
        </section>

        {p.isGuest && (
          <section className="block">
            <div className="label">The wall</div>
            {p.wall.length === 0 && <div className="hint">Nothing here yet. Say hi, or ask who&apos;s bringing snacks.</div>}
            {p.wall.map((w) => (
              <div className="post" key={w.id}>
                <Avatar username={w.username} size={32} />
                <div><b>@{w.username}{w.username === night.host ? " · host" : ""}</b><p>{w.body}</p></div>
              </div>
            ))}
            <form className="newgroup" onSubmit={sendPost}>
              <label className="sr" htmlFor="wall">Write on the wall</label>
              <input id="wall" className="field" maxLength={500} placeholder="Write something to the group" value={post} onChange={(e) => setPost(e.target.value)} />
              <button className="add big" disabled={!post.trim() || busy === "post"}>Post</button>
            </form>
          </section>
        )}

        {p.isHost && (
          <button className="link cancel-night" disabled={busy === "cancel"} onClick={cancel}>Cancel this night</button>
        )}
        <TmdbCredit />
      </div>
      {wheelOpen && <WheelSheet queue={p.wheelQueue} onUpNext={pickFromWheel} onClose={closeWheel} actionLabel="Watch this one" />}
    </>
  );
}
