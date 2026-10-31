import Link from "next/link";
import type { NightCard } from "@/lib/nights";
import { shortDay, time } from "@/lib/when";
import Avatar from "./Avatar";
import { headcount, kindLabel } from "./NightRow";
import RsvpButtons from "./RsvpButtons";

// The big "You're invited" card, with Going / Maybe / Can't go right on it.
export default function NightInviteCard({ night }: { night: NightCard }) {
  const where = night.place || night.groupName;
  return (
    <section className={`invite-card night ${night.kind}`}>
      <Link className="invite-link" href={`/n/${night.token}`}>
        <div className="invite-top">
          <span className="tag">You&apos;re invited</span>
          <span className="from">from @{night.host}</span>
        </div>
        <div>
          <span className="from">{kindLabel(night.kind)}</span>
          <h2>{night.title}</h2>
          <small>{[shortDay(night.startsAt, night.tz), time(night.startsAt, night.tz), where].filter(Boolean).join(" · ")}</small>
        </div>
      </Link>
      {night.going.length > 0 && (
        <div className="faces-line">
          <span className="faces">{night.going.slice(0, 4).map((u) => <Avatar key={u} username={u} size={24} />)}</span>
          <small>{headcount(night)}</small>
        </div>
      )}
      <RsvpButtons token={night.token} />
    </section>
  );
}
