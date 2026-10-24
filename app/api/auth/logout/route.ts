// POST /api/auth/logout
import { endSession } from "@/lib/auth";
import { guard } from "@/lib/api";

export function POST() {
  return guard(async () => {
    await endSession();
    return Response.json({ ok: true });
  });
}
