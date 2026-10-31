"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Card, Choice, SessionState } from "@/lib/pick";
import { fmtRun, MAX } from "@/lib/queue";
import Avatar from "./Avatar";
import { BackIcon, CheckIcon, XIcon } from "./icons";
import Poster from "./Poster";
import ShareButton from "./ShareButton";

type Props = {
  token: string;
  me: string;
  host: string;
  deck: Card[];
  loosened: boolean;
  initialState: SessionState;
  queueIds: string[];
  inFriends: Record<string, string[]>;
};

const EyeIcon = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const InfoIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" />
  </svg>
);

const THRESHOLD = 110;

// Swipe right to watch, left to pass. Alone, a "watch it" is your pick. With friends who opened
// the same link, it's a match once everyone has said yes to the same movie.
export default function SwipeDeck({ token, me, deck, loosened, initialState, queueIds, inFriends }: Props) {
  const [state, setState] = useState(initialState);
  const [mine, setMine] = useState(initialState.mine);
  const [match, setMatch] = useState<Card | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const [queue, setQueue] = useState(new Set(queueIds));
  const [queueCount, setQueueCount] = useState(queueIds.length);
  const [toastMsg, setToastMsg] = useState("");
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const shownMatches = useRef(new Set(initialState.matches));
  const drag = useRef<{ x: number; id: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const left = deck.filter((c) => !mine[c.id]);
  const card = left[0];
  const next = left[1];
  const group = state.members.length > 1;
  const swipes = Object.keys(mine).length;

  function toast(msg: string) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 1800);
  }

  // A match that hasn't been shown yet pops up the "It's a match" screen.
  function take(s: SessionState) {
    setState(s);
    const fresh = s.matches.find((id) => !shownMatches.current.has(id));
    if (fresh) {
      s.matches.forEach((id) => shownMatches.current.add(id));
      const c = deck.find((m) => m.id === fresh);
      if (c) setMatch(c);
    }
  }

  // With friends, check every few seconds for matches made by someone else's swipe.
  useEffect(() => {
    if (!group) return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/pick/${token}`);
        if (res.ok) take(await res.json());
      } catch {}
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, token]);

  async function choose(choice: Choice) {
    if (!card || leaving) return;
    const c = card;
    setLeaving(choice === "like" ? "right" : "left");
    setTimeout(() => {
      setMine((m) => ({ ...m, [c.id]: choice }));
      setLeaving(null);
      setDx(0);
    }, 220);
    try {
      const res = await fetch(`/api/pick/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ movieId: c.id, choice }),
      });
      if (res.status === 401) return window.location.reload();
      if (!res.ok) throw new Error();
      take(await res.json());
    } catch {
      toast("Couldn't save that swipe. Check your connection.");
    }
  }

  async function addToQueue(c: Card) {
    if (queueCount >= MAX) return toast("Your queue is full. Remove a movie to make room.");
    const movie = { id: c.id, tmdbId: c.tmdbId, title: c.title, year: c.year, runtime: c.runtime, posterPath: c.posterPath };
    const res = await fetch("/api/queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ movie }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok && Array.isArray(data.queue)) {
      setQueue(new Set(data.queue.map((m: { id: string }) => m.id)));
      setQueueCount(data.queue.length);
      toast(`Added “${c.title}” to your queue`);
    } else toast(data?.error || "Couldn't add it. Try again.");
  }

  // Dragging the card.
  function down(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("a,button")) return;
    drag.current = { x: e.clientX, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (drag.current?.id === e.pointerId) setDx(e.clientX - drag.current.x);
  }
  function up(e: React.PointerEvent) {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    if (dx > THRESHOLD) choose("like");
    else if (dx < -THRESHOLD) choose("pass");
    else setDx(0);
  }

  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (match || showMatches || (e.target as HTMLElement).closest("input,textarea")) return;
      if (e.key === "ArrowRight") choose("like");
      if (e.key === "ArrowLeft") choose("pass");
      if (e.key === "ArrowDown") choose("seen");
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });

  const matchCards = state.matches.map((id) => deck.find((c) => c.id === id)).filter((c): c is Card => !!c);
  const offset = leaving === "right" ? 600 : leaving === "left" ? -600 : dx;

  function cardInfo(c: Card) {
    const fit = c.fits.filter((f) => f.ok).length;
    const friends = inFriends[c.id];
    return (
      <>
        <span className="sw-title">{c.title} {c.year && <span>{c.year}</span>}</span>
        <span className="sw-meta">{[c.genres.join(" · "), fmtRun(c.runtime), c.director && `Dir. ${c.director}`].filter(Boolean).join(" · ")}</span>
        <span className="sw-tags">
          {c.fits.length > 0 && <span className="fit">Fits {fit} of your {c.fits.length} answers</span>}
          {friends && <span className="fit friend">In {friends.length === 1 ? `@${friends[0]}'s` : `${friends.length} friends'`} queue</span>}
          {group && (state.likes[c.id] ?? 0) > 0 && <span className="fit friend">{state.likes[c.id]} said yes</span>}
        </span>
      </>
    );
  }

  return (
    <>
      <div className="app swipe">
        <div className="ask-top">
          <Link className="round" href="/pick" aria-label="Back to the questions"><BackIcon /></Link>
          <span>{left.length} of {deck.length} left</span>
          <button className="round small-pill" onClick={() => setShowMatches(true)} aria-label={`Matches: ${matchCards.length}`}>
            <CheckIcon /> {matchCards.length}
          </button>
        </div>

        <div className="swipers">
          <span className="faces">{state.members.map((u) => <Avatar key={u} username={u} size={26} />)}</span>
          <small>{group ? `Swiping with ${state.members.filter((u) => u !== me).map((u) => `@${u}`).join(", ")}` : "Swipe together: friends who open your link join this round"}</small>
          <ShareButton path={`/pick/${token}`} text="Help me pick a movie! Swipe with me" label="Invite" className="pill ghost small" />
        </div>
        {loosened && <div className="tip">Not many movies fit every answer, so a few close ones are mixed in.</div>}

        {card ? (
          <>
            <div className="stack">
              {next && (
                <div className="swcard behind" aria-hidden="true">
                  <Poster movie={next} size="lg" />
                </div>
              )}
              <div
                key={card.id}
                className="swcard"
                style={{ transform: `translateX(${offset}px) rotate(${offset / 18}deg)`, transition: drag.current ? "none" : "transform .22s ease" }}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
              >
                <Poster movie={card} size="lg" />
                <span className="stamp yes" style={{ opacity: Math.max(0, Math.min(1, offset / THRESHOLD)) }}>Watch it</span>
                <span className="stamp no" style={{ opacity: Math.max(0, Math.min(1, -offset / THRESHOLD)) }}>Pass</span>
                <Link className="sw-info" href={`/movie/${card.tmdbId}?s=${token}`}>
                  {cardInfo(card)}
                  <span className="sw-more" aria-label="More about this movie"><InfoIcon /></span>
                </Link>
              </div>
            </div>
            <div className="sw-buttons">
              <button className="sw-btn no" aria-label="Not tonight" onClick={() => choose("pass")}><XIcon size={28} /></button>
              <button className="sw-btn seen" aria-label="Seen it already" onClick={() => choose("seen")}><EyeIcon /></button>
              <button className="sw-btn yes" aria-label="Watch it" onClick={() => choose("like")}>
                <svg width={30} height={30} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.1 5.2 3 1.6-1.9 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" /></svg>
              </button>
            </div>
            <p className="tip center">Swipe left to pass, right to watch. The eye means you&apos;ve seen it. Tap the card for more.</p>
          </>
        ) : (
          <div className="empty">
            <strong>That&apos;s all of them</strong>
            <span>
              {matchCards.length
                ? `You've got ${matchCards.length} ${matchCards.length === 1 ? "match" : "matches"}.`
                : group ? "No match yet. Your friends might still be swiping." : "Nothing grabbed you this time."}
            </span>
            {matchCards.length > 0 && <button className="pill" onClick={() => setShowMatches(true)}>See matches</button>}
            <Link className="pill ghost" href="/pick">Try different answers</Link>
          </div>
        )}
      </div>

      {match && (
        <div className="match" role="dialog" aria-modal="true" aria-labelledby="matchTitle">
          <div className="match-in">
            <span className="kind">{group ? "Everyone said yes" : "Tonight's pick"}</span>
            <h1 id="matchTitle">It&apos;s a<br />match!</h1>
            <Poster movie={match} size="lg" />
            <span className="tip center">
              {[match.title, match.year, match.director].filter(Boolean).join(" · ")}
              <br />
              {group ? `${state.members.length} of you swiped right` : `Found after ${swipes} ${swipes === 1 ? "swipe" : "swipes"}`}
            </span>
            <div className="match-actions">
              {queue.has(match.id) ? (
                <button className="pill" disabled>In your queue</button>
              ) : (
                <button className="pill" onClick={() => addToQueue(match)}>Add to my queue ({queueCount} of {MAX})</button>
              )}
              <Link className="pill hot" href={`/nights/new?tmdb=${match.tmdbId}`}>Plan a movie night with it</Link>
              <button className="pill ghost" onClick={() => setMatch(null)}>Keep swiping</button>
            </div>
          </div>
        </div>
      )}

      {showMatches && (
        <>
          <div className="scrim" onClick={() => setShowMatches(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="matchesTitle">
            <div className="sheet-in">
              <div className="sheet-head">
                <h3 id="matchesTitle">Matches</h3>
                <button className="close" onClick={() => setShowMatches(false)}>Done</button>
              </div>
              <div className="results">
                {matchCards.length === 0 && (
                  <div className="hint">{group ? "No movie everyone said yes to yet." : "Swipe right on a movie and it shows up here."}</div>
                )}
                {matchCards.map((c) => (
                  <div className="sres" key={c.id}>
                    <Poster movie={c} size="sm" />
                    <Link className="t plainlink" href={`/movie/${c.tmdbId}?s=${token}`}><b>{c.title} <span className="yr">{c.year}</span></b><small>{c.genres.join(" · ")}</small></Link>
                    {queue.has(c.id) ? <span className="pos">✓</span> : <button className="add" onClick={() => addToQueue(c)}>Add</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {toastMsg && <div className="toast swipe-toast" role="status">{toastMsg}</div>}
    </>
  );
}
