"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Movie } from "@/lib/types";
import { CheckIcon, PlusIcon } from "./icons";

// The round + next to a movie that isn't in your queue yet. Adds it to the end of your queue.
export default function AddToQueueButton({ movie, full }: { movie: Movie; full: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "added" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function add() {
    if (full) {
      setMsg("Your queue is full");
      return setState("error");
    }
    setState("busy");
    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ movie }),
      });
      if (res.status === 401) return window.location.reload();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't add it. Try again.");
      setState("added");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Couldn't add it. Try again.");
      setState("error");
    }
  }

  if (state === "added") {
    return <span className="addround done" role="status" aria-label={`${movie.title} added to your queue`}><CheckIcon /></span>;
  }
  return (
    <span className="addwrap">
      {state === "error" && <small className="adderr" role="alert">{msg}</small>}
      <button className="addround" disabled={state === "busy"} onClick={add} aria-label={`Add ${movie.title} to your queue`}>
        <PlusIcon size={18} />
      </button>
    </span>
  );
}
