import AuthForm from "@/components/AuthForm";
import MovieQueue from "@/components/MovieQueue";
import SetupNeeded from "@/components/SetupNeeded";
import { pendingCount } from "@/lib/friends";
import { pageUser } from "@/lib/page";
import { getQueue } from "@/lib/serverQueue";

export default async function Home() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) return <AuthForm />;

  const [queue, pending] = await Promise.all([getQueue(user.id), pendingCount(user.id)]);
  return <MovieQueue username={user.username} initialQueue={queue} pending={pending} />;
}
