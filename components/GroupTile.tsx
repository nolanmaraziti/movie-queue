import Link from "next/link";
import type { GroupSummary } from "@/lib/groups";
import { MAX } from "@/lib/queue";
import Poster from "./Poster";

// The square picture for a group: its first four posters in a 2 by 2 grid.
export function Mosaic({ group }: { group: GroupSummary }) {
  const top = group.queue.slice(0, 4);
  if (top.length === 0) {
    return <span className="mosaic none" aria-hidden="true">{group.name.charAt(0).toUpperCase()}</span>;
  }
  return (
    <span className="mosaic" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (top[i] ? <Poster key={top[i].id} movie={top[i]} size="md" /> : <i key={i} />))}
    </span>
  );
}

export function groupLine(g: GroupSummary) {
  const n = g.queue.length;
  const members = `${g.members.length} ${g.members.length === 1 ? "member" : "members"}`;
  return n >= MAX ? `${n} of ${MAX} · full` : `${n} of ${MAX} · ${members}`;
}

// A group on the home screen's grid.
export default function GroupTile({ group }: { group: GroupSummary }) {
  return (
    <Link className="gtile" href={`/groups/${group.id}`}>
      <Mosaic group={group} />
      <b>{group.name}</b>
      <small>{groupLine(group)}</small>
    </Link>
  );
}

// A group as one row in a list (profiles).
export function GroupRow({ group }: { group: GroupSummary }) {
  return (
    <Link className="grow" href={`/groups/${group.id}`}>
      <Mosaic group={group} />
      <span className="t"><b>{group.name}</b><small>{groupLine(group)}</small></span>
    </Link>
  );
}
