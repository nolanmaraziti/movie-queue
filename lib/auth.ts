// Accounts: password scrambling (hashing) and staying signed in. Server only.
import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { sql } from "./db";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "mq_session";
const SESSION_DAYS = 30;

export type User = { id: string; username: string };

// Usernames: 3 to 20 letters, numbers, dots or underscores. Stored in lowercase.
export function cleanUsername(raw: unknown) {
  const u = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return /^[a-z0-9_.]{3,20}$/.test(u) ? u : null;
}

export function passwordProblem(pw: unknown) {
  if (typeof pw !== "string" || pw.length < 8) return "Password needs at least 8 characters.";
  if (pw.length > 200) return "Password is too long.";
  return null;
}

// The password itself is never stored, only a one-way scramble of it with a random salt.
export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function checkPassword(pw: string, stored: string) {
  const [kind, salt, key] = stored.split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scryptAsync(pw, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

// Used when a username doesn't exist, so a wrong username takes as long as a wrong password.
export const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// Signing in gives the browser a random token in a cookie that page scripts can't read.
// The database keeps only a hash of it, so a database leak can't be used to sign in.
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await sql("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [sha256(token), userId, expires]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await sql("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  store.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await sql<User>(
    `SELECT u.id::text AS id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  return rows[0] ?? null;
}
