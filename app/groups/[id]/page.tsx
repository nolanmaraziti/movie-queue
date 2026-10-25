import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import GroupQueue from "@/components/GroupQueue";
import JoinButton from "@/components/JoinButton";
import Nav from "@/components/Nav";
import SetupNeeded from "@/components/SetupNeeded";
import { listPeople } from "@/lib/friends";
import { cleanGroupId, getGroup, members, membership } from "@/lib/groups";
import { navCounts, pageUser } from "@/lib/page";

type Params = { params: Promise<{ id: string }> };

// A group queue. Only people who've joined can see it; people who are invited get a Join button.
export default async function GroupPage({ params }: Params) {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");

  const id = cleanGroupId((await params).id);
  if (!id) notFound();
  const [status, group, counts] = await Promise.all([membership(id, user.id), getGroup(id), navCounts(user.id)]);
  if (!group) notFound();

  if (status !== "joined") {
    return (
      <div className="app">
        <header>
          <div className="top"><h1>{status === "invited" ? group.name : "Group queue"}</h1></div>
          <Nav username={user.username} {...counts} />
        </header>
        <div className="empty">
          <strong>{status === "invited" ? "You're invited" : "Members only"}</strong>
          {status === "invited" ? (
            <>
              <span>Join to see this queue and add movies to it.</span>
              <JoinButton groupId={id} />
            </>
          ) : (
            <>
              <span>You can see a group queue once someone in it invites you.</span>
              <Link className="add" href="/groups">Go to Groups</Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const [people, roster] = await Promise.all([listPeople(user.id), members(id)]);
  const inGroup = new Set(roster.map((m) => m.username));
  const invitable = people.filter((p) => p.status === "friends" && !inGroup.has(p.username)).map((p) => p.username);

  return (
    <GroupQueue
      groupId={id}
      name={group.name}
      username={user.username}
      counts={counts}
      initialQueue={group.queue}
      members={roster}
      invitable={invitable}
    />
  );
}

export async function generateMetadata({ params }: Params) {
  const id = cleanGroupId((await params).id);
  const { user } = await pageUser().catch(() => ({ user: null }));
  if (!id || !user || !(await membership(id, user.id))) return { title: "Group · Movie Queue" };
  const group = await getGroup(id);
  return { title: `${group?.name ?? "Group"} · Movie Queue` };
}
