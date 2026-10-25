import AuthForm from "@/components/AuthForm";
import MovieQueue from "@/components/MovieQueue";
import SetupNeeded from "@/components/SetupNeeded";
import { navCounts, pageUser } from "@/lib/page";
import { getQueue } from "@/lib/serverQueue";

export default async function Home() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) return <AuthForm />;

  const [queue, counts] = await Promise.all([getQueue(user.id), navCounts(user.id)]);
  return <MovieQueue username={user.username} initialQueue={queue} counts={counts} />;
}
