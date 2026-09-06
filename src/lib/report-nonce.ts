/**
 * Single-use permission to replace a site's paired-content inventory.
 *
 * The pairing token is published on purpose — it ships inside a <script> tag
 * on the creator's public website, which is what makes the product work. A
 * string that lives in public HTML can only ever be a READ capability, but it
 * was also the sole authorization on /api/content/<token>/report, an endpoint
 * that does `DELETE FROM site_content WHERE site_id = ?` and re-inserts
 * whatever was posted. Scrape the token from any customer's page source, POST
 * one item, and every edit that creator ever made is gone.
 *
 * So the write is split off from the read. A nonce is minted only by the
 * overrides endpoint, and only when that endpoint has decided a report is
 * genuinely wanted — first pairing, an explicit re-sync from the dashboard, or
 * an empty inventory. In steady state no nonce is ever issued, so the
 * destructive path simply isn't reachable, and the window where it is lasts
 * minutes rather than forever.
 *
 * In-memory for the same reason ratelimit.ts is: one Node process, one SQLite
 * file, nothing to coordinate with. Losing these on restart costs a snippet
 * one extra round trip.
 */

import { randomBytes } from "crypto";

/** Long enough to survive a slow page and a slow DOM walk, short enough to matter. */
const NONCE_TTL_MS = 5 * 60_000;

/** Bounded so a loop against the overrides endpoint cannot grow this forever. */
const MAX_OUTSTANDING = 5_000;

interface Issued {
  siteId: number;
  expiresAt: number;
}

interface NonceStore {
  nonces: Map<string, Issued>;
  lastSweep: number;
}

type GlobalWithNonces = typeof globalThis & { __ensembleReportNonces?: NonceStore };

// Pinned to globalThis for the same reason the rate limiter is: Next compiles
// route handlers into separate server bundles, and a plain module-level Map
// would give the overrides route and the report route different copies.
const store: NonceStore = ((globalThis as GlobalWithNonces).__ensembleReportNonces ??= {
  nonces: new Map<string, Issued>(),
  lastSweep: 0,
});

function sweep(now: number): void {
  if (now - store.lastSweep < 60_000) return;
  store.lastSweep = now;
  for (const [nonce, issued] of store.nonces) {
    if (issued.expiresAt <= now) store.nonces.delete(nonce);
  }
}

/** Mint a nonce that authorises exactly one report for this site. */
export function issueReportNonce(siteId: number): string {
  const now = Date.now();
  sweep(now);
  if (store.nonces.size >= MAX_OUTSTANDING) {
    // Drop the oldest rather than refusing: a legitimate snippet asking for a
    // nonce should never be starved by someone else's flood.
    const oldest = [...store.nonces.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) store.nonces.delete(oldest[0]);
  }
  const nonce = randomBytes(18).toString("base64url");
  store.nonces.set(nonce, { siteId, expiresAt: now + NONCE_TTL_MS });
  return nonce;
}

/**
 * Spend a nonce. True only if it exists, is unexpired, and belongs to this
 * site — and it cannot be spent twice.
 */
export function consumeReportNonce(nonce: string, siteId: number): boolean {
  if (!nonce) return false;
  const now = Date.now();
  sweep(now);
  const issued = store.nonces.get(nonce);
  if (!issued) return false;
  store.nonces.delete(nonce);
  return issued.siteId === siteId && issued.expiresAt > now;
}
