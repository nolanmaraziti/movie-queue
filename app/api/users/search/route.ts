// GET /api/users/search?q=sam
// Finds people by username, and says whether you're already friends with each one.
import { signedIn } from "@/lib/api";
import { sql } from "@/lib/db";
import type { Person } from "@/lib/friends";

export function GET(request: Request) {
  return signedIn(async (me) => {
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 20);
    if (!q) return Response.json({ results: [] });

    // Escape % and _ so they're searched as normal characters.
    const like = q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    const results = await sql<Person>(
      `SELECT u.username,
         CASE WHEN f.status = 'accepted' THEN 'friends' WHEN f.from_id = $1 THEN 'sent'
              WHEN f.to_id = $1 THEN 'received' ELSE 'none' END AS status
       FROM users u
       LEFT JOIN friendships f ON (f.from_id = $1 AND f.to_id = u.id) OR (f.to_id = $1 AND f.from_id = u.id)
       WHERE u.username LIKE $2 AND u.id <> $1
       ORDER BY u.username = $3 DESC, u.username
       LIMIT 20`,
      [me.id, like, q],
    );
    return Response.json({ results });
  });
}
