// Shared start of every page: who's signed in, or why the database isn't ready. Server only.
import "server-only";
import { currentUser, type User } from "./auth";
import { DbError } from "./db";

export async function pageUser(): Promise<{ user: User | null; setupError?: string }> {
  try {
    return { user: await currentUser() };
  } catch (err) {
    console.error(err);
    if (err instanceof DbError) return { user: null, setupError: err.message };
    throw err;
  }
}
