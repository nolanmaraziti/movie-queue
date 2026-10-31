import Link from "next/link";
import { redirect } from "next/navigation";
import GroupsPanel from "@/components/GroupsPanel";
import { BackIcon } from "@/components/icons";
import SetupNeeded from "@/components/SetupNeeded";
import TabBar from "@/components/TabBar";
import TmdbCredit from "@/components/TmdbCredit";
import { myGroups, myInvites } from "@/lib/groups";
import { navCounts, pageUser } from "@/lib/page";

export const metadata = { title: "Groups · Movie Queue" };

export default async function GroupsPage() {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");

  const [groups, invites, counts] = await Promise.all([myGroups(user.id), myInvites(user.id), navCounts(user.id)]);

  return (
    <>
      <div className="app">
        <div className="bar">
          <Link className="round" href="/" aria-label="Back to your queue"><BackIcon /></Link>
        </div>
        <div className="top"><h1>Group queues</h1></div>
        <main>
          <GroupsPanel groups={groups} invites={invites} />
        </main>
        <TmdbCredit />
      </div>
      <TabBar username={user.username} pending={counts.pending} nights={counts.nights} />
    </>
  );
}
