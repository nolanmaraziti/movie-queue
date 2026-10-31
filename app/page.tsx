import AuthForm from "@/components/AuthForm";
import MovieQueue from "@/components/MovieQueue";
import SetupNeeded from "@/components/SetupNeeded";
import { friendsWithQueues } from "@/lib/friends";
import { myGroups, myInvites } from "@/lib/groups";
import { myNights } from "@/lib/nights";
import { navCounts, pageUser } from "@/lib/page";
import { getQueue } from "@/lib/serverQueue";

export default async function Home() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) return <AuthForm />;

  const [queue, counts, groups, invites, friends, nights] = await Promise.all([
    getQueue(user.id),
    navCounts(user.id),
    myGroups(user.id),
    myInvites(user.id),
    friendsWithQueues(user.id),
    myNights(user.id),
  ]);
  return (
    <MovieQueue
      username={user.username}
      pending={counts.pending}
      nightCount={counts.nights}
      nightInvites={nights.upcoming.filter((n) => n.rsvp === "pending")}
      comingUp={nights.upcoming.filter((n) => n.rsvp === "going" || n.rsvp === "maybe").slice(0, 3)}
      initialQueue={queue}
      groups={groups}
      invites={invites}
      friends={friends}
    />
  );
}
