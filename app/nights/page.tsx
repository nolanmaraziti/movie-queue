import Link from "next/link";
import { redirect } from "next/navigation";
import SetupNeeded from "@/components/SetupNeeded";
import TabBar from "@/components/TabBar";
import { navCounts, pageUser } from "@/lib/page";

export const metadata = { title: "Movie nights · Movie Queue" };

// Movie nights are the next thing being built. Until then, this tab says so.
export default async function NightsPage() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");
  const counts = await navCounts(user.id);

  return (
    <>
      <div className="app">
        <div className="top"><h1>Movie nights</h1></div>
        <div className="empty">
          <strong>Coming soon</strong>
          <span>Plan a night, invite friends, and vote on what to watch from a group queue. It&apos;s on the way.</span>
          <Link className="add" href="/">Back to your queue</Link>
        </div>
      </div>
      <TabBar username={user.username} pending={counts.pending} />
    </>
  );
}
