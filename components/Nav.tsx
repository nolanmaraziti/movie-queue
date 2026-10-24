"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The row under the title: who's signed in, Queue / Friends links, and Log out.
export default function Nav({ username, pending }: { username: string; pending: number }) {
  const path = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/");
  }

  return (
    <nav className="nav">
      <Link href="/" aria-current={path === "/" ? "page" : undefined}>My queue</Link>
      <Link href="/friends" aria-current={path === "/friends" ? "page" : undefined}>
        Friends{pending > 0 && <span className="badge" aria-label={`${pending} new requests`}>{pending}</span>}
      </Link>
      <span className="me">@{username}</span>
      <button className="link" onClick={logout}>Log out</button>
    </nav>
  );
}
