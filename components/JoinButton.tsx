"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// "Join" on a group you've been invited to. The page then reloads as a member.
export default function JoinButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/groups/${groupId}`, { method: "POST" }).catch(() => null);
    if (res?.ok) return router.refresh();
    setError("That didn't work. Try again.");
    setBusy(false);
  }

  return (
    <>
      <button className="add" disabled={busy} onClick={join}>Join group</button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
