"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FriendStatus } from "@/lib/friends";
import { CheckIcon } from "./icons";

// The button on someone's profile: Add friend, Accept, Requested, or Friends (tap to unfriend).
export default function FriendButton({ username, status }: { username: string; status: FriendStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(method: "POST" | "DELETE") {
    setBusy(true);
    setError("");
    const res = await fetch("/api/friends", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username }),
    }).catch(() => null);
    if (res?.status === 401) return window.location.reload();
    if (!res?.ok) setError("That didn't work. Try again.");
    router.refresh();
    setBusy(false);
  }

  let button;
  if (status === "friends") {
    button = (
      <button className="pill ghost" disabled={busy} onClick={() => confirm(`Unfriend @${username}?`) && act("DELETE")}>
        <CheckIcon /> Friends
      </button>
    );
  } else if (status === "received") {
    button = <button className="pill" disabled={busy} onClick={() => act("POST")}>Accept request</button>;
  } else if (status === "sent") {
    button = <button className="pill ghost" disabled={busy} onClick={() => act("DELETE")}>Requested · Cancel</button>;
  } else {
    button = <button className="pill" disabled={busy} onClick={() => act("POST")}>Add friend</button>;
  }

  return (
    <>
      {button}
      {error && <span className="hint" role="alert">{error}</span>}
    </>
  );
}
