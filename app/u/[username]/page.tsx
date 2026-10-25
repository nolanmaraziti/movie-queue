import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Poster from "@/components/Poster";
import SetupNeeded from "@/components/SetupNeeded";
import TmdbCredit from "@/components/TmdbCredit";
import { cleanUsername } from "@/lib/auth";
import { statusWith, userIdFor } from "@/lib/friends";
import { navCounts, pageUser } from "@/lib/page";
import { fmtRun, MAX } from "@/lib/queue";
import { getQueue } from "@/lib/serverQueue";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params) {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)} · Movie Queue` };
}

// A friend's queue, read only. Movies that are on your queue too get a "You both" tag.
export default async function FriendQueue({ params }: Params) {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");

  const username = cleanUsername(decodeURIComponent((await params).username));
  if (!username) notFound();
  if (username === user.username) redirect("/");
  const theirId = await userIdFor(username);
  if (!theirId) notFound();

  const [status, counts] = await Promise.all([statusWith(user.id, theirId), navCounts(user.id)]);
  const header = (count?: number, note?: string) => (
    <header>
      <div className="top">
        <h1>@{username}</h1>
        {count !== undefined && <div className="count">{count}<span>/{MAX}</span></div>}
      </div>
      {count !== undefined && (
        <div className="meter" aria-hidden="true">
          {Array.from({ length: MAX }, (_, i) => <i key={i} className={i < count ? "on" : ""} />)}
        </div>
      )}
      {note && <div className="sub"><span>{note}</span></div>}
      <Nav username={user.username} {...counts} />
    </header>
  );

  if (status !== "friends") {
    return (
      <div className="app">
        {header()}
        <div className="empty">
          <strong>Friends only</strong>
          <span>You can see @{username}&apos;s queue once you&apos;re friends.</span>
          <Link className="add" href="/friends">Go to Friends</Link>
        </div>
      </div>
    );
  }

  const [theirs, mine] = await Promise.all([getQueue(theirId), getQueue(user.id)]);
  const myIds = new Set(mine.map((m) => m.id));
  const common = theirs.filter((m) => myIds.has(m.id)).length;

  return (
    <div className="app">
      {header(theirs.length, common ? `${common} ${common === 1 ? "movie" : "movies"} in common` : "No movies in common yet")}
      <main>
        {theirs.length === 0 ? (
          <div className="empty">
            <strong>Nothing queued</strong>
            <span>@{username} hasn&apos;t added any movies yet.</span>
          </div>
        ) : (
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="label">Their queue</div>
            <ol>
              {theirs.map((m, i) => (
                <li key={m.id} className={`row ro${i === 0 ? " first" : ""}`}>
                  <span className="num">{i + 1}</span>
                  <Poster movie={m} size="sm" />
                  <div className="t">
                    {i === 0 && <span className="chip">Up next</span>}
                    {myIds.has(m.id) && <span className="chip both">You both</span>}
                    <b>{m.title}</b>
                    <small>{[m.year, fmtRun(m.runtime)].filter(Boolean).join(" · ")}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
      <TmdbCredit />
    </div>
  );
}
