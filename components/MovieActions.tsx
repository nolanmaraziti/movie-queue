"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Movie } from "@/lib/types";

type Props = { movie: Movie; session?: string; inQueue: boolean; full: boolean; swiped?: string };

// The buttons along the bottom of a movie's profile. From a swipe round: Not tonight / Watch it.
// Otherwise: add it to your queue, or plan a night with it.
export default function MovieActions({ movie, session, inQueue, full, swiped }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(inQueue);
  const [error, setError] = useState("");

  async function swipe(choice: "like" | "pass") {
    setBusy(true);
    const res = await fetch(`/api/pick/${session}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ movieId: movie.id, choice }),
    }).catch(() => null);
    if (res?.ok) return router.push(`/pick/${session}`);
    setError("Couldn't save that. Try again.");
    setBusy(false);
  }

  async function add() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ movie }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) setAdded(true);
    else setError(data?.error || "Couldn't add it. Try again.");
    setBusy(false);
  }

  return (
    <div className="movie-actions">
      {error && <div className="hint" role="alert">{error}</div>}
      <div className="two">
        {session && !swiped ? (
          <>
            <button className="pill ghost big" disabled={busy} onClick={() => swipe("pass")}>Not tonight</button>
            <button className="pill hot big" disabled={busy} onClick={() => swipe("like")}>Watch it</button>
          </>
        ) : (
          <>
            {added ? (
              <button className="pill ghost big" disabled>In your queue</button>
            ) : (
              <button className="pill big" disabled={busy || full} onClick={add}>{full ? "Queue is full" : "Add to my queue"}</button>
            )}
            <Link className="pill hot big" href={`/nights/new?tmdb=${movie.tmdbId}`}>Plan a night</Link>
          </>
        )}
      </div>
    </div>
  );
}
