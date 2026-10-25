import { redirect } from "next/navigation";
import GroupsPanel from "@/components/GroupsPanel";
import Nav from "@/components/Nav";
import SetupNeeded from "@/components/SetupNeeded";
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
    <div className="app">
      <header>
        <div className="top">
          <h1>Group<br />Queues</h1>
          <div className="count">{groups.length}</div>
        </div>
        <Nav username={user.username} {...counts} />
      </header>
      <main>
        <GroupsPanel groups={groups} invites={invites} />
      </main>
      <TmdbCredit />
    </div>
  );
}
