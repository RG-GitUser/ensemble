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
  // Work-in-progress mode: funnel every signed-out visitor to the landing
  // page, which carries the overlay. Without this the overlay only hides one
  // route and /signup, /s/… and the rest stay wide open. /login is the way
  // back in, so it must never be redirected, and anyone holding a session
  // passes straight through.
  if (process.env.WIP_MODE === "1" && !req.cookies.get("fs_session")) {
    const path = req.nextUrl.pathname;
    if (path !== "/" && !path.startsWith("/login")) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];

  // The CNAME target is plumbing, not a destination. It has to stay a platform
  // host (creators' domains point at it, and a bare visit must not 404 as an
  // unknown customer domain), but rendering the marketing site here means
  // anyone poking at the value from the DNS instructions lands on a duplicate
  // of the homepage. Send them to the real one instead.
  const cnameTarget = process.env.DOMAIN_CNAME_TARGET?.toLowerCase();
  if (cnameTarget && host === cnameTarget) {
    return NextResponse.redirect(process.env.APP_URL || `https://${platformHosts().values().next().value ?? host}`);
  }

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
