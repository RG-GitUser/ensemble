import { getSiteById, resolveDomain } from "@/lib/db";
import { getPlan } from "@/lib/plans";

/**
 * Caddy's on_demand_tls `ask` endpoint: 200 means "issue a certificate for
 * ?domain=", anything else refuses. Kept fast and body-less — it sits on the
 * TLS handshake path for first-time visitors.
 */
export function GET(req: Request): Response {
  const domain = new URL(req.url).searchParams.get("domain")?.toLowerCase().split(":")[0] ?? "";
  const match = domain ? resolveDomain(domain) : null;
  const site = match ? getSiteById(match.siteId) : null;
  const ok = !!site && getPlan(site.plan).customDomain;
  return new Response(null, { status: ok ? 200 : 404 });
}
