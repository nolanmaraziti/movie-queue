// POST /api/auth/signup  { username, password, queue }
// Makes a new account. "queue" is whatever was saved in this browser before accounts existed.
import { cleanUsername, hashPassword, passwordProblem, startSession } from "@/lib/auth";
import { fail, guard, readJson } from "@/lib/api";
import { sql } from "@/lib/db";
import { cleanQueue } from "@/lib/serverQueue";

export function POST(request: Request) {
  return guard(async () => {
    const body = await readJson(request);
    const username = cleanUsername(body.username);
    if (!username) return fail("Usernames are 3 to 20 letters, numbers, dots or underscores.");
    const problem = passwordProblem(body.password);
    if (problem) return fail(problem);

    const rows = await sql<{ id: string }>(
      `INSERT INTO users (username, password_hash, queue) VALUES ($1, $2, $3)
       ON CONFLICT (username) DO NOTHING RETURNING id::text`,
      [username, await hashPassword(body.password as string), JSON.stringify(cleanQueue(body.queue))],
    );
    if (!rows[0]) return fail("That username is taken. Try another one.", 409);

    await startSession(rows[0].id);
    return Response.json({ ok: true });
  });
}
