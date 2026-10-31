// Saving and loading profile pictures. Server only.
import "server-only";
import { type Pic, cleanPic } from "./avatar";
import { sql } from "./db";

export async function getPics(usernames: string[]): Promise<Record<string, Pic>> {
  if (!usernames.length) return {};
  const rows = await sql<{ username: string; avatar: unknown }>(
    "SELECT username, avatar FROM users WHERE username = ANY($1) AND avatar IS NOT NULL",
    [usernames],
  );
  const out: Record<string, Pic> = {};
  for (const r of rows) {
    const pic = cleanPic(r.avatar);
    if (pic) out[r.username] = pic;
  }
  return out;
}

export async function getPic(username: string) {
  return (await getPics([username]))[username] ?? null;
}

export async function setPic(userId: string, pic: Pic | null) {
  await sql("UPDATE users SET avatar = $2 WHERE id = $1", [userId, pic ? JSON.stringify(pic) : null]);
}
