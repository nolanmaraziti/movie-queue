"use client";

import { useState } from "react";

type Props = { label: string; className?: string } & ({ username: string } | { path: string; text: string });

// Shares a link (your profile, or a movie night). Uses the phone's share menu when there is one, otherwise copies the link.
export default function ShareButton(props: Props) {
  const { label, className = "pill" } = props;
  const [done, setDone] = useState(false);

  async function share() {
    const url = window.location.origin + ("path" in props ? props.path : `/u/${props.username}`);
    const text = "path" in props ? props.text : `Add me on Movie Queue: @${props.username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Movie Queue", text, url });
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
