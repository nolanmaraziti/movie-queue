import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import GuestInvite from "@/components/GuestInvite";
import NightView from "@/components/NightView";
import SetupNeeded from "@/components/SetupNeeded";
import TabBar from "@/components/TabBar";
import { getGroup } from "@/lib/groups";
import { cleanToken, findVisitor, getNight, guests, posts, visitorCookie, visitors } from "@/lib/nights";
import { navCounts, pageUser } from "@/lib/page";
import { getQueue } from "@/lib/serverQueue";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ join?: string; new?: string }> };

export async function generateMetadata({ params }: Props) {
  const token = cleanToken((await params).token);
  const night = token ? await getNight(token).catch(() => null) : null;
  return { title: night ? `${night.title} · Movie Queue` : "Movie night · Movie Queue" };
}

// A movie night's invitation. Signed-in people get the full page; anyone else with the link
// can still answer with just their name.
export default async function NightPage({ params, searchParams }: Props) {
  const token = cleanToken((await params).token);
  if (!token) notFound();
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  const night = await getNight(token);
  if (!night) notFound();
  const sp = await searchParams;
  const [guestList, visitorList] = await Promise.all([guests(night.id), visitors(night.id)]);
  const goingCount = guestList.filter((g) => g.rsvp === "going").length + visitorList.filter((v) => v.rsvp === "going").length;
  const maybeCount = guestList.filter((g) => g.rsvp === "maybe").length + visitorList.filter((v) => v.rsvp === "maybe").length;

  if (!user) {
    if (sp.join) return <AuthForm note={`Log in or sign up to vote and see who's coming to “${night.title}”.`} />;
    const visitor = await findVisitor(night.id, (await cookies()).get(visitorCookie(night.id))?.value);
    return (
      <GuestInvite
        token={token}
        host={night.host}
        title={night.title}
        kind={night.kind}
        startsAt={night.startsAt}
        tz={night.tz}
        place={night.place}
        address={visitor && visitor.rsvp !== "no" ? night.address : ""}
        note={night.note}
        going={guestList.filter((g) => g.rsvp === "going").map((g) => g.username)}
        goingCount={goingCount}
        maybeCount={maybeCount}
        answered={visitor ? { name: visitor.name, rsvp: visitor.rsvp } : null}
      />
    );
  }

  const isHost = user.id === night.hostId;
  const mine = guestList.find((g) => g.username === user.username);
  const isGuest = !!mine;
  const canSeeAddress = isHost || mine?.rsvp === "going" || mine?.rsvp === "maybe";
  // The host spins the wheel from the queue the night is using.
  const wheelQueue = isHost && night.pickMode === "spin" && !night.movie
    ? night.groupId ? (await getGroup(night.groupId))?.queue ?? [] : await getQueue(night.hostId)
    : [];
  const [wall, counts] = await Promise.all([isGuest ? posts(night.id) : Promise.resolve([]), navCounts(user.id)]);

  return (
    <>
      <NightView
        me={user.username}
        isHost={isHost}
        isGuest={isGuest}
        justMade={!!sp.new && isHost}
        night={{ ...night, address: canSeeAddress ? night.address : "", hostId: "" }}
        hasAddress={!!night.address}
        myRsvp={mine?.rsvp ?? null}
        myVote={mine?.vote ?? null}
        guests={guestList.map((g) => ({ username: g.username, rsvp: g.rsvp, vote: g.vote }))}
        visitors={visitorList.map((v) => ({ name: v.name, rsvp: v.rsvp, phone: isHost ? v.phone : "" }))}
        goingCount={goingCount}
        maybeCount={maybeCount}
        wall={wall}
        wheelQueue={wheelQueue}
      />
      <TabBar username={user.username} pending={counts.pending} nights={counts.nights} />
    </>
  );
}
