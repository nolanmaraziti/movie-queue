"use client";

import { useState } from "react";

// Shares a link to your profile. Uses the phone's share menu when there is one, otherwise copies the link.
export default function ShareButton({ username, label, className = "pill" }: { username: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);

  async function share() {
    const url = `${window.location.origin}/u/${username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Movie Queue", text: `Add me on Movie Queue: @${username}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      // Closing the share menu counts as an error; nothing to do.
    }
  }

  return (
    <button className={className} onClick={share}>
      {done ? "Link copied" : label}
    </button>
  );
}
