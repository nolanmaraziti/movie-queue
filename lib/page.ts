// Shared start of every page: who's signed in, or why the database isn't ready. Server only.
import "server-only";
import { currentUser, type User } from "./auth";
import { DbError } from "./db";
import { pendingCount } from "./friends";
import { inviteCount } from "./groups";
import { pendingNightCount } from "./nights";

export async function pageUser(): Promise<{ user: User | null; setupError?: string }> {
  try {
    return { user: await currentUser() };
  } catch (err) {
    if (!(err instanceof DbError)) throw err;
    console.error(err);
    return { user: null, setupError: err.message };
  }
}

// The little red numbers on the tabs: friend requests, group invites and movie night invites waiting for you.
export async function navCounts(userId: string) {
  const [pending, invites, nights] = await Promise.all([pendingCount(userId), inviteCount(userId), pendingNightCount(userId)]);
  return { pending, invites, nights };
}
