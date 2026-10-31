"use client";

import { useState } from "react";
import type { NightCard } from "@/lib/nights";
import NightInviteCard from "./NightInviteCard";
import NightRow from "./NightRow";

type Props = { me: string; upcoming: NightCard[]; past: NightCard[] };
type Tab = "upcoming" | "invites" | "past";

// The Nights tab's three lists: upcoming, invites waiting on you, and past nights.
export default function NightsList({ me, upcoming, past }: Props) {
  const invites = upcoming.filter((n) => n.rsvp === "pending");
  const going = upcoming.filter((n) => n.rsvp === "going" || n.rsvp === "maybe");
  const declined = upcoming.filter((n) => n.rsvp === "no");
  const [tab, setTab] = useState<Tab>(invites.length && !going.length ? "invites" : "upcoming");

  return (
    <>
      <div className="segs" role="tablist" aria-label="Which nights">
        <button role="tab" aria-selected={tab === "upcoming"} onClick={() => setTab("upcoming")}>Upcoming</button>
        <button role="tab" aria-selected={tab === "invites"} onClick={() => setTab("invites")}>
          Invites{invites.length > 0 && ` · ${invites.length}`}
        </button>
        <button role="tab" aria-selected={tab === "past"} onClick={() => setTab("past")}>Past</button>
      </div>

      {tab === "upcoming" && (
        <>
          {invites.length > 0 && (
            <section className="block">
              <div className="label">Waiting on your answer</div>
              {invites.map((n) => <NightInviteCard key={n.token} night={n} />)}
            </section>
          )}
          <section className="block">
            <div className="label">You&apos;re going</div>
            {going.length === 0 && <div className="hint">Nothing planned yet. Tap “Plan one” to start a movie night.</div>}
            {going.map((n) => <NightRow key={n.token} night={n} me={me} />)}
          </section>
          {declined.length > 0 && (
            <section className="block">
              <div className="label">You can&apos;t make it</div>
              {declined.map((n) => <NightRow key={n.token} night={n} me={me} />)}
            </section>
          )}
        </>
      )}

      {tab === "invites" && (
        <section className="block">
          {invites.length === 0 && <div className="hint">No invites waiting. When a friend invites you, it shows up here.</div>}
          {invites.map((n) => <NightInviteCard key={n.token} night={n} />)}
        </section>
      )}

      {tab === "past" && (
        <section className="block">
          {past.length === 0 && <div className="hint">Nights you went to show up here afterwards.</div>}
          {past.map((n) => <NightRow key={n.token} night={n} me={me} />)}
        </section>
      )}
    </>
  );
}
