import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "crypto";
import { promisify } from "util";
import { createSession, deleteSession, getSessionUser } from "./db";
import type { User } from "./types";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

const COOKIE = "fs_session";
const SESSION_DAYS = 30;

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "rileyg0035@gmail.com").toLowerCase();

/**
 * Password hashing.
 *
 * ASYNC, not scryptSync. Hashing on the main thread blocks the single event
 * loop for tens of milliseconds per attempt — several times that on a shared
 * vCPU — which made the login form a whole-platform denial of service as well
 * as a password oracle. The async form runs on libuv's threadpool, so a burst
 * of attempts costs CPU instead of stalling every other tenant's request.
 *
 * The cost parameters are recorded IN the hash. Without them the cost could
 * never be raised without invalidating every stored password, because there
 * would be no way to tell which parameters an old hash was written with.
 * `needsRehash` plus the upgrade-on-login path in `login` is what makes
 * raising them a config change rather than a migration.
 */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const { N, r, p } = SCRYPT_PARAMS;
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, KEYLEN, { N, r, p })).toString("hex");
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`;
}

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: string;
  hash: string;
  /** Written before the parameters were recorded — `salt:hash`. */
  legacy: boolean;
}

function parseHash(stored: string): ParsedHash | null {
  if (stored.startsWith("scrypt$")) {
    const [, N, r, p, salt, hash] = stored.split("$");
    if (!N || !r || !p || !salt || !hash) return null;
    const parsed = { N: Number(N), r: Number(r), p: Number(p), salt, hash, legacy: false };
    if (!Number.isFinite(parsed.N) || !Number.isFinite(parsed.r) || !Number.isFinite(parsed.p)) return null;
    return parsed;
  }
  // Legacy `salt:hash`, written with Node's scryptSync defaults — which are
  // exactly SCRYPT_PARAMS, so these still verify.
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return null;
  return { ...SCRYPT_PARAMS, salt, hash, legacy: true };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  try {
    const candidate = await scrypt(password, parsed.salt, KEYLEN, { N: parsed.N, r: parsed.r, p: parsed.p });
    const expected = Buffer.from(parsed.hash, "hex");
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

/** True when a stored hash is weaker than what we write today. */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  return parsed.legacy || parsed.N < SCRYPT_PARAMS.N || parsed.r < SCRYPT_PARAMS.r || parsed.p < SCRYPT_PARAMS.p;
}

export async function startSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  createSession(token, userId, expiresAt);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) deleteSession(token);
  jar.delete(COOKIE);
}

/** The caller's own session token, for "sign out my other browsers". */
export async function currentSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(token);
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
