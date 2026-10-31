import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AddToQueueButton from "@/components/AddToQueueButton";
import AuthForm from "@/components/AuthForm";
import Avatar from "@/components/Avatar";
import FriendButton from "@/components/FriendButton";
import { GroupRow } from "@/components/GroupTile";
import { BackIcon } from "@/components/icons";
import NightRow from "@/components/NightRow";
import Poster from "@/components/Poster";
import SetupNeeded from "@/components/SetupNeeded";
import TabBar from "@/components/TabBar";
import TmdbCredit from "@/components/TmdbCredit";
import { cleanUsername } from "@/lib/auth";
import { getPic } from "@/lib/avatars";
import { friendsSince, statusWith, userIdFor } from "@/lib/friends";
import { groupsInCommon } from "@/lib/groups";
import { nightsInCommon } from "@/lib/nights";
import { navCounts, pageUser } from "@/lib/page";
import { fmtRun, MAX } from "@/lib/queue";
import { getQueue } from "@/lib/serverQueue";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params) {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)} · Movie Queue` };
}

// Someone's profile. Friends see their queue (with "You both" tags), and the groups you share.
// Anyone else sees an Add friend button, which is what a shared profile link is for.
export default async function FriendProfile({ params }: Params) {
  const username = cleanUsername(decodeURIComponent((await params).username));
  if (!username) notFound();

  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) return <AuthForm note={`Log in or sign up to add @${username} as a friend.`} />;
  if (username === user.username) redirect("/profile");
  const theirId = await userIdFor(username);
  if (!theirId) notFound();

  const [status, counts, pic] = await Promise.all([statusWith(user.id, theirId), navCounts(user.id), getPic(username)]);
  const friends = status === "friends";
  const [theirs, mine, since, groups, nights] = friends
    ? await Promise.all([
        getQueue(theirId), getQueue(user.id), friendsSince(user.id, theirId), groupsInCommon(user.id, theirId), nightsInCommon(user.id, theirId),
      ])
    : [[], [], null, [], []];
  const myIds = new Set(mine.map((m) => m.id));
  const common = theirs.filter((m) => myIds.has(m.id)).length;
  const full = mine.length >= MAX;
  const sinceText = since ? `Friends since ${new Date(since).toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : "";

  return (
    <>
      <div className="app">
        <div className="bar">
          <Link className="round" href="/friends" aria-label="Back to friends"><BackIcon /></Link>
        </div>
        <section className="profile-head">
          {pic ? (
            <Link className="pic-link" href={`/movie/${pic.tmdbId}`} aria-label={`@${username}'s picture is from ${pic.title || "a movie"}. See the movie`}>
              <Avatar username={username} size={96} pic={pic} />
            </Link>
          ) : (
            <Avatar username={username} size={96} pic={null} />
          )}
          <h1>@{username}</h1>
          {sinceText && <span className="tip">{sinceText}</span>}
          <div className="profile-actions">
            <FriendButton username={username} status={status} />
            {friends && <Link className="pill hot" href={`/nights/new?friend=${username}`}>Invite to a night</Link>}
          </div>
        </section>

        {!friends && (
          <div className="empty">
            <strong>Friends only</strong>
            <span>
              {status === "received"
                ? `@${username} wants to be friends. Accept to see each other's queues.`
                : status === "sent"
                  ? `You'll see @${username}'s queue once they accept.`
                  : `Add @${username} as a friend to see each other's queues.`}
            </span>
          </div>
        )}

        {friends && (
          <main className="home">
            <section className="qlist">
              <div className="list-head">
                <div className="label">@{username}&apos;s queue · {theirs.length} of {MAX}</div>
                {common > 0 && <span className="tip">{common} also in yours</span>}
              </div>
              {theirs.length === 0 ? (
                <div className="hint">@{username} hasn&apos;t added any movies yet.</div>
              ) : (
                <ol>
                  {theirs.map((m, i) => (
                    <li key={m.id} className={`row ro${i === 0 ? " first" : ""}`}>
                      <span className="num">{i + 1}</span>
                      <Poster movie={m} size="sm" />
                      <div className="t">
                        {i === 0 && <span className="chip">Up next</span>}
                        <b>{m.title}</b>
                        <small>{[m.year, fmtRun(m.runtime)].filter(Boolean).join(" · ")}</small>
                      </div>
                      {myIds.has(m.id) ? <span className="chip both">You both</span> : <AddToQueueButton movie={m} full={full} />}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {groups.length > 0 && (
              <section className="block">
                <div className="label">Groups you&apos;re both in</div>
                {groups.map((g) => <GroupRow key={g.id} group={g} />)}
              </section>
            )}

            {nights.length > 0 && (
              <section className="block">
                <div className="label">Nights you&apos;re both going to</div>
                {nights.map((n) => <NightRow key={n.token} night={n} me={user.username} />)}
              </section>
            )}
          </main>
        )}
        <TmdbCredit />
      </div>
      <TabBar username={user.username} pending={counts.pending} nights={counts.nights} />
    </>
  );
}
