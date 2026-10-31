import AuthForm from "@/components/AuthForm";
import MovieQueue from "@/components/MovieQueue";
import SetupNeeded from "@/components/SetupNeeded";
import { friendsWithQueues } from "@/lib/friends";
import { myGroups, myInvites } from "@/lib/groups";
import { navCounts, pageUser } from "@/lib/page";
import { getQueue } from "@/lib/serverQueue";

export default async function Home() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) return <AuthForm />;

  const [queue, counts, groups, invites, friends] = await Promise.all([
    getQueue(user.id),
    navCounts(user.id),
    myGroups(user.id),
    myInvites(user.id),
    friendsWithQueues(user.id),
  ]);
  return (
    <MovieQueue
      username={user.username}
      pending={counts.pending}
      initialQueue={queue}
      groups={groups}
      invites={invites}
      friends={friends}
    />
  );
}
