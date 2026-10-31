// GET /api/avatars?u=ana,ben
// Profile pictures for a few usernames at once. People without one are left out.
import { cleanUsername } from "@/lib/auth";
import { getPics } from "@/lib/avatars";
import { guard } from "@/lib/api";

export async function GET(request: Request) {
  return guard(async () => {
    const raw = new URL(request.url).searchParams.get("u") ?? "";
    const names = [...new Set(raw.split(",").map(cleanUsername).filter((u): u is string => !!u))].slice(0, 60);
    return Response.json({ pics: await getPics(names) }, { headers: { "cache-control": "private, max-age=30" } });
  });
}
