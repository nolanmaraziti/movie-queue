"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Avatar from "./Avatar";
import { FriendsIcon, NightsIcon, QueueIcon } from "./icons";

type Props = { username: string; pending: number };

// The bar along the bottom: Queue, Nights, Friends, Profile.
export default function TabBar({ username, pending }: Props) {
  const path = usePathname();
  const on = (test: boolean) => (test ? "page" : undefined);

  return (
    <nav className="tabbar" aria-label="Main">
      <Link href="/" aria-current={on(path === "/" || path.startsWith("/groups"))}>
        <QueueIcon />Queue
      </Link>
      <Link href="/nights" aria-current={on(path.startsWith("/nights"))}>
        <NightsIcon />Nights
      </Link>
      <Link href="/friends" aria-current={on(path === "/friends" || path.startsWith("/u/"))}>
        <span className="tab-ico">
          <FriendsIcon />
          {pending > 0 && <span className="badge" aria-label={`${pending} friend requests`}>{pending}</span>}
        </span>
        Friends
      </Link>
      <Link href="/profile" aria-current={on(path === "/profile")}>
        <Avatar username={username} size={24} />Profile
      </Link>
    </nav>
  );
}
