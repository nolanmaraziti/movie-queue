import { redirect } from "next/navigation";
import FriendsPanel from "@/components/FriendsPanel";
import Nav from "@/components/Nav";
import SetupNeeded from "@/components/SetupNeeded";
import TmdbCredit from "@/components/TmdbCredit";
import { listPeople, userIdFor } from "@/lib/friends";
import { pageUser } from "@/lib/page";
import { getQueue } from "@/lib/serverQueue";

export const metadata = { title: "Friends · Movie Queue" };

export default async function FriendsPage() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");

  const [people, mine] = await Promise.all([listPeople(user.id), getQueue(user.id)]);
  const myIds = new Set(mine.map((m) => m.id));

  // For each friend: how many movies are on both your queues.
  const friends = await Promise.all(
    people
      .filter((p) => p.status === "friends")
      .map(async (p) => {
        const id = await userIdFor(p.username);
        const theirs = id ? await getQueue(id) : [];
        return {
          username: p.username,
          movies: theirs.map((m) => ({ ...m, both: myIds.has(m.id) })),
          common: theirs.filter((m) => myIds.has(m.id)).length,
        };
      }),
  );
  const received = people.filter((p) => p.status === "received").map((p) => p.username);
  const sent = people.filter((p) => p.status === "sent").map((p) => p.username);

  return (
    <div className="app">
      <header>
        <div className="top">
          <h1>Your<br />Friends</h1>
          <div className="count">{friends.length}</div>
        </div>
        <Nav username={user.username} pending={received.length} />
      </header>
      <main>
        <FriendsPanel friends={friends} received={received} sent={sent} />
      </main>
      <TmdbCredit />
    </div>
  );
}
