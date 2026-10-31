import Link from "next/link";
import type { NightCard } from "@/lib/nights";
import { dayNum, month, time, weekday } from "@/lib/when";
import Avatar from "./Avatar";

export const kindLabel = (kind: string) => (kind === "theater" ? "In theaters" : "Movie club · at home");

export function DateBlock({ iso, tz, hot }: { iso: string; tz: string; hot?: boolean }) {
  return (
    <span className={`dateblock${hot ? " hot" : ""}`}>
      <span>{month(iso, tz)}</span>
      <b>{dayNum(iso, tz)}</b>
    </span>
  );
}

export function headcount(n: { goingCount: number; maybeCount: number }) {
  const parts = [`${n.goingCount} going`];
  if (n.maybeCount) parts.push(`${n.maybeCount} maybe`);
  return parts.join(", ");
}

const RSVP_TAG: Record<string, string> = { going: "Going", maybe: "Maybe", no: "Can't go", pending: "Invited" };

// One movie night in a list, linking to its page.
export default function NightRow({ night, me }: { night: NightCard; me: string }) {
  const hosting = night.host === me;
  const where = night.place || night.groupName || "";
  return (
    <Link className="nrow" href={`/n/${night.token}`}>
      <DateBlock iso={night.startsAt} tz={night.tz} hot={night.kind === "theater"} />
      <span className="t">
        <span className={`kind ${night.kind}`}>{kindLabel(night.kind)}</span>
        <b>{night.title}</b>
        <small>{[weekday(night.startsAt, night.tz), time(night.startsAt, night.tz), where].filter(Boolean).join(" · ")}</small>
        <span className="faces-line">
          <span className="faces">
            {night.going.slice(0, 4).map((u) => <Avatar key={u} username={u} size={22} />)}
          </span>
          <small>{headcount(night)}{night.movie ? ` · ${night.movie.title}` : ""}</small>
        </span>
      </span>
      <span className={`rtag ${night.rsvp}`}>{hosting ? "Hosting" : RSVP_TAG[night.rsvp]}</span>
    </Link>
  );
}
