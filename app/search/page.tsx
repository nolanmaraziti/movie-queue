import { redirect } from "next/navigation";
import SearchScreen from "@/components/SearchScreen";
import SetupNeeded from "@/components/SetupNeeded";
import { friendsWithQueues } from "@/lib/friends";
import { myGroups } from "@/lib/groups";
import { pageUser } from "@/lib/page";
import { getQueue } from "@/lib/serverQueue";
import type { Movie } from "@/lib/types";

export const metadata = { title: "Search · Movie Queue" };

export default async function SearchPage() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");

  const [queue, friends, groups] = await Promise.all([getQueue(user.id), friendsWithQueues(user.id), myGroups(user.id)]);

  // Which friends have each movie queued, so results can say "In @maya's queue".
  const inFriends: Record<string, string[]> = {};
  const byId: Record<string, Movie> = {};
  for (const f of friends) {
    for (const m of f.queue) {
      (inFriends[m.id] ??= []).push(f.username);
      byId[m.id] ??= m;
    }
  }
  // "Popular with your friends": the movies queued by the most friends.
  const popular = Object.entries(inFriends)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8)
    .map(([id, who]) => ({ movie: byId[id], count: who.length }));

  return (
    <SearchScreen
      initialQueue={queue}
      inFriends={inFriends}
      popular={popular}
      groups={groups}
    />
  );
}
