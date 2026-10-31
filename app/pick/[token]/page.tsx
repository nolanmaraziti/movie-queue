import { notFound, redirect } from "next/navigation";
import SetupNeeded from "@/components/SetupNeeded";
import SwipeDeck from "@/components/SwipeDeck";
import { friendsWithQueues } from "@/lib/friends";
import { pageUser } from "@/lib/page";
import { cleanPickToken, getSession, joinSession, sessionState } from "@/lib/pick";
import { getQueue } from "@/lib/serverQueue";

export const metadata = { title: "Swipe · Movie Queue" };

type Props = { params: Promise<{ token: string }> };

export default async function SwipePage({ params }: Props) {
  const { user, setupError } = await pageUser();
  if (setupError) return <SetupNeeded message={setupError} />;
  if (!user) redirect("/");
  const token = cleanPickToken((await params).token);
  const session = token ? await getSession(token) : null;
  if (!session) notFound();

  await joinSession(session.id, user.id);
  const [state, queue, friends] = await Promise.all([sessionState(session.id, user.id), getQueue(user.id), friendsWithQueues(user.id)]);

  // Which friends have each movie in the deck queued up.
  const inFriends: Record<string, string[]> = {};
  for (const f of friends) for (const m of f.queue) if (session.deck.some((c) => c.id === m.id)) (inFriends[m.id] ??= []).push(f.username);

  return (
    <SwipeDeck
      token={session.token}
      me={user.username}
      host={session.host}
      deck={session.deck}
      loosened={session.loosened}
      initialState={state}
      queueIds={queue.map((m) => m.id)}
      inFriends={inFriends}
    />
  );
}
