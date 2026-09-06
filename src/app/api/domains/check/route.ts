import { getSiteById, resolveDomain } from "@/lib/db";
import { planFor } from "@/lib/billing";

/**
 * Caddy's on_demand_tls `ask` endpoint: 200 means "issue a certificate for
 * ?domain=", anything else refuses. Kept fast and body-less — it sits on the
 * TLS handshake path for first-time visitors.
 *
 * The GATE here is correct and load-bearing: an unverified domain cannot earn
 * a certificate, so outsider-driven Let's Encrypt exhaustion is genuinely
 * prevented. What was missing is a limit on the ASK traffic itself. Every TLS
 * ClientHello carrying an unknown SNI costs one HTTP request into the single
 * Node process plus one synchronous SQLite query, and arbitrary SNI needs no
 * DNS at all — so a loop of handshakes degrades the app for every tenant, and
 * when it stops answering Caddy can no longer complete handshakes for ANY
 * custom domain.
 *
 * So answers are cached, negatives included. A negative is the cheap, common,
 * floodable case; a positive is cached briefly so a real certificate issuance
 * is never blocked for long by a stale "no".
 */
const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 5 * 60_000;
const MAX_CACHE = 10_000;

type AskCache = Map<string, { ok: boolean; expiresAt: number }>;

// globalThis for the same reason the rate limiter uses it: route handlers are
// compiled into their own server bundle.
const cache: AskCache = ((globalThis as typeof globalThis & { __ensembleAskCache?: AskCache }).__ensembleAskCache ??=
  new Map());

function cachedAnswer(domain: string): boolean | null {
  const hit = cache.get(domain);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(domain);
    return null;
  }
  return hit.ok;
}

function remember(domain: string, ok: boolean): void {
  // Bounded, so a flood of unique SNI values cannot grow this without limit.
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(domain, { ok, expiresAt: Date.now() + (ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS) });
}

export function GET(req: Request): Response {
  const domain = new URL(req.url).searchParams.get("domain")?.toLowerCase().split(":")[0] ?? "";
  if (!domain) return new Response(null, { status: 404 });

  const cached = cachedAnswer(domain);
  if (cached !== null) return new Response(null, { status: cached ? 200 : 404 });

  const match = resolveDomain(domain);
  const site = match ? getSiteById(match.siteId) : null;
  const ok = !!site && planFor(site).customDomain;
  remember(domain, ok);
  return new Response(null, { status: ok ? 200 : 404 });
}
