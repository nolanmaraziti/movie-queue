import { redirect } from "next/navigation";
import PlanNight from "@/components/PlanNight";
import SetupNeeded from "@/components/SetupNeeded";
import { listPeople } from "@/lib/friends";
import { myGroups } from "@/lib/groups";
import { pageUser } from "@/lib/page";
import { getQueue } from "@/lib/serverQueue";

export const metadata = { title: "Plan a movie night · Movie Queue" };

type Props = { searchParams: Promise<{ friend?: string; group?: string }> };

export default async function NewNightPage({ searchParams }: Props) {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");

  const [queue, groups, people, sp] = await Promise.all([getQueue(user.id), myGroups(user.id), listPeople(user.id), searchParams]);
  const friends = people.filter((p) => p.status === "friends").map((p) => p.username);

  return (
    <PlanNight
      myQueue={queue}
      groups={groups.map((g) => ({ id: g.id, name: g.name, queue: g.queue, others: g.members.filter((m) => m !== user.username) }))}
      friends={friends}
      startFriend={sp.friend && friends.includes(sp.friend) ? sp.friend : undefined}
      startGroup={sp.group && groups.some((g) => g.id === sp.group) ? sp.group : undefined}
    />
  );
}
