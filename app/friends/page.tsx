import { redirect } from "next/navigation";
import FriendsPanel from "@/components/FriendsPanel";
import SetupNeeded from "@/components/SetupNeeded";
import TabBar from "@/components/TabBar";
import TmdbCredit from "@/components/TmdbCredit";
import { friendsWithQueues, listPeople, requestsWithMutuals } from "@/lib/friends";
import { navCounts, pageUser } from "@/lib/page";
import { getQueue } from "@/lib/serverQueue";

export const metadata = { title: "Friends · Movie Queue" };

export default async function FriendsPage() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");

  const [friends, requests, people, mine, counts] = await Promise.all([
    friendsWithQueues(user.id),
    requestsWithMutuals(user.id),
    listPeople(user.id),
    getQueue(user.id),
    navCounts(user.id),
  ]);
  const sent = people.filter((p) => p.status === "sent").map((p) => p.username);

  return (
    <>
      <div className="app">
        <FriendsPanel
          username={user.username}
          friends={friends}
          requests={requests}
          sent={sent}
          myIds={mine.map((m) => m.id)}
        />
        <TmdbCredit />
      </div>
      <TabBar username={user.username} pending={counts.pending} />
    </>
  );
}
