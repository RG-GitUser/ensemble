/**
 * Fixed-window rate limiting for the public write endpoints.
 *
 * Ensemble runs as a single Node process against a local SQLite file, so an
 * in-memory counter is the whole mechanism. There is no second server to
 * coordinate with, and no reason to pay a database round trip on every
 * visitor request. Counters reset when the process restarts, which is
 * the right trade here. A deploy briefly forgives a flooder rather than
 * locking out a real visitor.
 */

import { headers } from "next/headers";

export interface Limit {
  /** How many requests are allowed inside one window. */
  max: number;
  /** Window length, in milliseconds. */
  windowMs: number;
}

/** Every public limit in one place, so they are easy to find and tune. */
export const LIMITS = {
  /** Chat is conversational, so the cap sits well above a normal typing pace. */
  chat: { max: 10, windowMs: 60_000 },
  /** A real visitor subscribes once. Past a handful it is a script. */
  newsletter: { max: 5, windowMs: 10 * 60_000 },
  /**
   * Password resets. Low enough that the form cannot be used to mailbomb an
   * address or to grind reset tokens, high enough to survive a person
   * mistyping their address twice and asking again.
   */
  passwordReset: { max: 5, windowMs: 15 * 60_000 },
} satisfies Record<string, Limit>;

interface Window {
  count: number;
  resetAt: number;
}

interface LimiterStore {
  windows: Map<string, Window>;
  lastSweep: number;
}

type GlobalWithLimiter = typeof globalThis & { __ensembleRateLimit?: LimiterStore };

/**
 * Next compiles route handlers and server actions into separate server
 * bundles, so a plain module-level Map gets instantiated more than once and
 * each entry point quietly counts into its own copy. That would hand a
 * flooder one full budget on the hosted page and a second on the embed
 * endpoint. Pinning the store to globalThis gives every bundle the same
 * counters, and it survives the module reloads that dev-mode HMR causes.
 */
const store: LimiterStore = ((globalThis as GlobalWithLimiter).__ensembleRateLimit ??= {
  windows: new Map<string, Window>(),
  lastSweep: 0,
});

/** Drop finished windows so a long-running process does not grow without bound. */
function sweep(now: number): void {
  if (now - store.lastSweep < 60_000) return;
  store.lastSweep = now;
  for (const [key, window] of store.windows) {
    if (window.resetAt <= now) store.windows.delete(key);
  }
}

export interface LimitResult {
  ok: boolean;
  /** Whole seconds until the caller may retry. Zero when ok is true. */
  retryAfter: number;
}

/**
 * Count one request against `key`. Callers build the key from the limit name,
 * the caller's address, and whatever else scopes the limit (usually the site).
 */
export function rateLimit(key: string, limit: Limit): LimitResult {
  const now = Date.now();
  sweep(now);

  const current = store.windows.get(key);
  if (!current || current.resetAt <= now) {
    store.windows.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (current.count >= limit.max) {
    return { ok: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }
  current.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Just enough of the Headers shape to accept both `headers()` and `req.headers`. */
type HeaderBag = { get(name: string): string | null };

/**
 * The caller's address as seen through Caddy.
 *
 * Caddy appends the connecting peer to any X-Forwarded-For the client already
 * sent, so the trustworthy address is the LAST entry rather than the first.
 * Reading the first entry (the usual idiom, and the one to reach for out of
 * habit) would let anyone clear their own limit just by sending the header.
 * There is exactly one hop to trust because ufw opens only 80 and 443, so
 * nothing reaches port 3000 except Caddy. See deploy/Caddyfile and DEPLOY.md.
 * If port 3000 is ever exposed directly, this becomes spoofable again.
 */
export function ipFromHeaders(h: HeaderBag): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  // Direct hit with no proxy, which in practice means local development.
  return h.get("x-real-ip")?.trim() || "local";
}

/** `ipFromHeaders` for server actions and route handlers. */
export async function clientIp(): Promise<string> {
  return ipFromHeaders(await headers());
}
