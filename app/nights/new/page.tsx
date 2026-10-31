import { redirect } from "next/navigation";
import PlanNight from "@/components/PlanNight";
import SetupNeeded from "@/components/SetupNeeded";
import { listPeople } from "@/lib/friends";
import { myGroups } from "@/lib/groups";
import { pageUser } from "@/lib/page";
import { getQueue } from "@/lib/serverQueue";
import { getMovie } from "@/lib/tmdb";

export const metadata = { title: "Plan a movie night · Movie Queue" };

type Props = { searchParams: Promise<{ friend?: string; group?: string; tmdb?: string }> };

export default async function NewNightPage({ searchParams }: Props) {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");

  const [queue, groups, people, sp] = await Promise.all([getQueue(user.id), myGroups(user.id), listPeople(user.id), searchParams]);
  const friends = people.filter((p) => p.status === "friends").map((p) => p.username);
  // "Plan a movie night with it" from a match or a movie's profile: the movie is already chosen.
  const tmdb = Number(sp.tmdb);
  const preset = Number.isInteger(tmdb) && tmdb > 0 ? await getMovie(tmdb).catch(() => null) : null;

  return (
    <PlanNight
      myQueue={queue}
      groups={groups.map((g) => ({ id: g.id, name: g.name, queue: g.queue, others: g.members.filter((m) => m !== user.username) }))}
      friends={friends}
      startFriend={sp.friend && friends.includes(sp.friend) ? sp.friend : undefined}
      startGroup={sp.group && groups.some((g) => g.id === sp.group) ? sp.group : undefined}
      preset={preset}
    />
  );
}
