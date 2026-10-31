"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Movie } from "@/lib/types";
import Poster from "./Poster";

type Group = { id: string; name: string; queue: Movie[]; others: string[] };
type Props = { myQueue: Movie[]; groups: Group[]; friends: string[]; startFriend?: string; startGroup?: string; preset?: Movie | null };
type Kind = "home" | "theater";
type Pick = "vote" | "upnext" | "spin";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "Plan a movie night": what kind, what to call it, how to pick the movie, when, where, and who to invite.
export default function PlanNight({ myQueue, groups, friends, startFriend, startGroup, preset }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("home");
  const [title, setTitle] = useState(preset ? `${preset.title} night` : "");
  const [source, setSource] = useState(startGroup ?? "");
  const [pick, setPick] = useState<Pick>("vote");
  const [date, setDate] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("20:00");
  const [place, setPlace] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [inviteGroups, setInviteGroups] = useState<string[]>(startGroup ? [startGroup] : []);
  const [inviteFriends, setInviteFriends] = useState<string[]>(startFriend ? [startFriend] : []);
  const [chosen, setChosen] = useState<Movie | null>(preset ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Today's date in your own time zone, filled in after the page loads.
  useEffect(() => setDate(ymd(new Date())), []);

  const queue = source ? groups.find((g) => g.id === source)?.queue ?? [] : myQueue;
  const sourceName = source ? groups.find((g) => g.id === source)?.name ?? "the group" : "your";
  const top3 = queue.slice(0, 3).map((m) => m.title).join(", ");

  function chooseSource(id: string) {
    setSource(id);
    if (id && !inviteGroups.includes(id)) setInviteGroups([...inviteGroups, id]);
  }

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // Everyone who'll get an invite, counting each person once.
  const invited = new Set([...inviteFriends, ...groups.filter((g) => inviteGroups.includes(g.id)).flatMap((g) => g.others)]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const startsAt = new Date(`${date}T${timeOfDay}`);
    try {
      if (!date || Number.isNaN(startsAt.getTime())) throw new Error("Pick a date and time.");
      const res = await fetch("/api/nights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind, title, note, place, address: kind === "home" ? address : "",
          startsAt: startsAt.toISOString(),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          groupId: source || null,
          pickMode: pick,
          tmdbId: chosen?.tmdbId ?? null,
          friends: inviteFriends,
          groups: inviteGroups,
        }),
      });
      if (res.status === 401) return window.location.reload();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work. Try again.");
      router.push(`/n/${data.token}?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="formbar">
        <Link className="link plain" href="/nights">Cancel</Link>
        <b>New movie night</b>
        <span />
      </div>

      <form className="plan" onSubmit={submit}>
        <fieldset>
          <legend className="label">What kind of night?</legend>
          <div className="kinds">
            <button type="button" aria-pressed={kind === "home"} onClick={() => setKind("home")}>
              <b>Movie club</b><small>Watch at someone&apos;s place</small>
            </button>
            <button type="button" aria-pressed={kind === "theater"} onClick={() => setKind("theater")}>
              <b>Theater screening</b><small>Meet up at a cinema</small>
            </button>
          </div>
        </fieldset>

        <label>
          <span className="label">Name it</span>
          <input
            className="field"
            required
            maxLength={80}
            placeholder={kind === "home" ? "Dune night at my place" : "Late show: Nosferatu"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <fieldset>
          <legend className="label">Which movie?</legend>
          {chosen && (
            <div className="picked">
              <Poster movie={chosen} size="sm" />
              <span className="t"><b>{chosen.title}</b><small>{chosen.year}</small></span>
              <button type="button" className="link plain" onClick={() => setChosen(null)}>Change</button>
            </div>
          )}
          {!chosen && groups.length > 0 && (
            <label className="inline">
              <span>Choose from</span>
              <select className="field" value={source} onChange={(e) => chooseSource(e.target.value)}>
                <option value="">My queue</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
          {!chosen && <div className="picks">
            <label>
              <span><b>Let guests vote</b><small>{queue.length ? `Top ${Math.min(3, queue.length)}: ${top3}` : "The queue is empty"}</small></span>
              <input type="radio" name="pick" checked={pick === "vote"} onChange={() => setPick("vote")} />
            </label>
            <label>
              <span><b>Up next in {source ? "the group" : "my"} queue</b><small>{queue[0]?.title ?? "The queue is empty"}</small></span>
              <input type="radio" name="pick" checked={pick === "upnext"} onChange={() => setPick("upnext")} />
            </label>
            <label>
              <span><b>Spin the wheel on the night</b><small>A surprise from {sourceName === "your" ? "your" : sourceName} queue</small></span>
              <input type="radio" name="pick" checked={pick === "spin"} onChange={() => setPick("spin")} />
            </label>
          </div>}
        </fieldset>

        <div className="two">
          <label><span className="label">Date</span><input className="field" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label><span className="label">Time</span><input className="field" type="time" required value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} /></label>
        </div>

        <label>
          <span className="label">Where</span>
          <input
            className="field"
            maxLength={100}
            placeholder={kind === "home" ? "My place" : "AMC Lincoln Square 13"}
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </label>
        {kind === "home" && (
          <label>
            <span className="label">Address</span>
            <input className="field" maxLength={200} placeholder="Optional" value={address} onChange={(e) => setAddress(e.target.value)} />
            <small className="hint">Only people who say they&apos;re going (or maybe) can see it.</small>
          </label>
        )}
        <label>
          <span className="label">Anything else?</span>
          <input className="field" maxLength={280} placeholder="Snacks, blankets, phones down at 8" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <fieldset>
          <legend className="label">Invite</legend>
          {groups.length === 0 && friends.length === 0 && (
            <div className="hint">Add friends first, or share the invite link once the night is made.</div>
          )}
          <div className="chips">
            {groups.map((g) => (
              <button type="button" key={g.id} className="chipbtn" aria-pressed={inviteGroups.includes(g.id)} onClick={() => toggle(inviteGroups, setInviteGroups, g.id)}>
                {g.name} · {g.others.length + 1}
              </button>
            ))}
            {friends.map((f) => (
              <button type="button" key={f} className="chipbtn" aria-pressed={inviteFriends.includes(f)} onClick={() => toggle(inviteFriends, setInviteFriends, f)}>
                @{f}
              </button>
            ))}
          </div>
          <small className="hint">You&apos;ll also get a link to send anyone. They can answer without an account.</small>
        </fieldset>

        {error && <div className="full" role="alert">{error}</div>}
        <button className="pill big" disabled={busy}>
          {busy ? "One moment…" : invited.size ? `Send ${invited.size} ${invited.size === 1 ? "invite" : "invites"}` : "Make the night"}
        </button>
      </form>
    </div>
  );
}
