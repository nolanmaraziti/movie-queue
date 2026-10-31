import Link from "next/link";
import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import { Mosaic } from "@/components/GroupTile";
import { ChevronIcon } from "@/components/icons";
import LogoutButton from "@/components/LogoutButton";
import Poster from "@/components/Poster";
import SetupNeeded from "@/components/SetupNeeded";
import ShareButton from "@/components/ShareButton";
import TabBar from "@/components/TabBar";
import TmdbCredit from "@/components/TmdbCredit";
import { listPeople } from "@/lib/friends";
import { myGroups } from "@/lib/groups";
import { myNights } from "@/lib/nights";
import { navCounts, pageUser } from "@/lib/page";
import { MAX } from "@/lib/queue";
import { getQueue } from "@/lib/serverQueue";

export const metadata = { title: "Profile · Movie Queue" };

// Your own profile: a few numbers, what's up next, and your groups.
export default async function ProfilePage() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");

  const [queue, people, groups, counts, nights] = await Promise.all([
    getQueue(user.id),
    listPeople(user.id),
    myGroups(user.id),
    navCounts(user.id),
    myNights(user.id),
  ]);
  const nightCount = nights.past.length + nights.upcoming.filter((n) => n.rsvp === "going" || n.rsvp === "maybe").length;
  const friendCount = people.filter((p) => p.status === "friends").length;
  const next = queue[0];

  return (
    <>
      <div className="app">
        <section className="profile-head">
          <Avatar username={user.username} size={96} />
          <h1>@{user.username}</h1>
          <div className="stats">
            <div><span>{queue.length}</span><small>In queue</small></div>
            <Link href="/friends"><span>{friendCount}</span><small>{friendCount === 1 ? "Friend" : "Friends"}</small></Link>
            <Link href="/nights"><span>{nightCount}</span><small>{nightCount === 1 ? "Movie night" : "Movie nights"}</small></Link>
          </div>
          <div className="profile-actions two">
            <ShareButton username={user.username} label="Share profile" className="pill" />
            <LogoutButton />
          </div>
        </section>

        <main className="home">
          <Link className="upnext-card" href="/">
            {next ? <Poster movie={next} size="sm" /> : <span className="poster sm blank" />}
            <span className="t">
              {next && <span className="chip">Up next</span>}
              <b>{next ? next.title : "Nothing queued yet"}</b>
              <small>{queue.length} of {MAX} in my queue</small>
            </span>
            <ChevronIcon />
          </Link>

          <section className="block">
            <div className="label">My groups</div>
            {groups.length === 0 ? (
              <div className="hint">You&apos;re not in any groups yet. <Link href="/groups">Start one</Link>.</div>
            ) : (
              <div className="hscroll">
                {groups.map((g) => (
                  <Link key={g.id} href={`/groups/${g.id}`} className="mini-group">
                    <Mosaic group={g} />
                    <small>{g.name}</small>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </main>
        <TmdbCredit />
      </div>
      <TabBar username={user.username} pending={counts.pending} nights={counts.nights} />
    </>
  );
}
