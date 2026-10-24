// POST /api/auth/login  { username, password, queue }
// Signs in. Movies saved in this browser ("queue") are added to the account's queue.
import { checkPassword, cleanUsername, DUMMY_HASH, startSession } from "@/lib/auth";
import { fail, guard, readJson } from "@/lib/api";
import { sql } from "@/lib/db";
import { cleanQueue, getQueue, mergeQueues, setQueue } from "@/lib/serverQueue";

export function POST(request: Request) {
  return guard(async () => {
    const body = await readJson(request);
    const username = cleanUsername(body.username) ?? "";
    const password = typeof body.password === "string" ? body.password : "";

    const rows = await sql<{ id: string; password_hash: string }>(
      "SELECT id::text, password_hash FROM users WHERE username = $1",
      [username],
    );
    const user = rows[0];
    const ok = await checkPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) return fail("Wrong username or password.", 401);

    const local = cleanQueue(body.queue);
    if (local.length) await setQueue(user.id, mergeQueues(await getQueue(user.id), local));

    await startSession(user.id);
    return Response.json({ ok: true });
  });
}
