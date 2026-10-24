// Small helpers shared by the API routes. Server only.
import "server-only";
import { currentUser, type User } from "./auth";
import { DbError } from "./db";

export const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

// Runs a route, turning database problems into a readable message instead of a crash.
export async function guard(run: () => Promise<Response>) {
  try {
    return await run();
  } catch (err) {
    console.error(err);
    return fail(err instanceof DbError ? err.message : "Something went wrong. Try again.", 500);
  }
}

// Same as guard, for routes that need you to be signed in.
export function signedIn(run: (me: User) => Promise<Response>) {
  return guard(async () => {
    const me = await currentUser();
    return me ? run(me) : fail("Please log in again.", 401);
  });
}
