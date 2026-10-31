"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Answer = "going" | "maybe" | "no";
const LABELS: [Answer, string][] = [["going", "Going"], ["maybe", "Maybe"], ["no", "Can't go"]];

// Going / Maybe / Can't go. Signed-in guests only; people without an account use the guest form.
export default function RsvpButtons({ token, current, short }: { token: string; current?: string; short?: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function answer(rsvp: Answer) {
    setBusy(true);
    setError("");
    const before = picked;
    setPicked(rsvp);
    try {
      const res = await fetch(`/api/nights/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "rsvp", rsvp }),
      });
      if (res.status === 401) return window.location.reload();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work. Try again.");
      router.refresh();
    } catch (err) {
      setPicked(before);
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    }
    setBusy(false);
  }

  return (
    <>
      <div className="rsvp">
        {LABELS.map(([value, label]) => (
          <button key={value} aria-pressed={picked === value} disabled={busy} onClick={() => answer(value)}>
            {short && value === "no" ? "Can't" : label}
          </button>
        ))}
      </div>
      {error && <div className="hint" role="alert">{error}</div>}
    </>
  );
}
