import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { platformHosts } from "@/lib/domains";

/**
 * Custom-domain routing. A request whose Host isn't one of the platform's own
 * hostnames is a creator's connected domain: rewrite it (invisibly) to
 * /domain/[host], which resolves the hostname against the custom_domains
 * table and renders that creator's page. Unknown hosts 404 there.
 *
 * PLATFORM_HOSTS must list the real platform hostnames in production — a
 * platform host missing from the list would be treated as a customer domain.
 */
export function proxy(req: NextRequest): NextResponse {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];
  if (!host || platformHosts().has(host)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/domain/${host}`;
  // Marks the request as proxy-rewritten so /domain/[host] can refuse
  // direct hits on the platform URL.
  const headers = new Headers(req.headers);
  headers.set("x-ensemble-domain", host);
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  // Skip API routes, Next internals and the embed/pairing scripts — those must
  // behave the same on every host. Every other path on a custom domain (any
  // path at all) serves the creator's page.
  matcher: ["/((?!api/|_next/|favicon\\.ico|embed\\.js|connect\\.js).*)"],
};
