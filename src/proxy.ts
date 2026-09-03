import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { platformHosts } from "@/lib/domains";
import { isReservedSlug } from "@/lib/slugs";

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
  /**
   * Work-in-progress mode: funnel signed-out visitors to the landing page,
   * which carries the overlay, so the unfinished funnel stays out of sight.
   *
   * Published creator pages are exempt. Those are the product's output, not
   * its shopfront — a creator who publishes and shares a link needs that
   * link to work whatever state our marketing site is in. /login is the way
   * back in, so it is never redirected, and anyone holding a session passes
   * straight through.
   */
  if (process.env.WIP_MODE === "1" && !req.cookies.get("fs_session")) {
    const path = req.nextUrl.pathname;
    // Creator pages sit at the root now, so there is no prefix to match on.
    // A single non-reserved segment is a possible creator page and is let
    // through — an unknown one simply 404s, which reveals nothing about the
    // funnel we're hiding. /s/ stays public for the old-address redirect.
    const segments = path.split("/").filter(Boolean);
    const maybeCreatorPage = segments.length === 1 && !isReservedSlug(segments[0]);
    // Privacy, terms and documents stay reachable in WIP mode: platform app
    // reviewers follow those links signed out, and a privacy page that 404s
    // fails the review.
    const isPublic =
      path === "/" ||
      path.startsWith("/login") ||
      // Password recovery has to survive WIP mode. Someone already holding an
      // account is exactly who is meant to get in while the funnel is shut,
      // and a reset link that redirects to the landing page is a dead link.
      path.startsWith("/forgot") ||
      path.startsWith("/reset/") ||
      path.startsWith("/recover") ||
      path.startsWith("/verify-backup/") ||
      path === "/s" ||
      path.startsWith("/s/") ||
      path === "/privacy" ||
      path === "/terms" ||
      path === "/documents" ||
      maybeCreatorPage;
    if (!isPublic) {
      // 307 preserves the method and body, and server actions are dispatched by
      // an id in a header rather than by route — so a POST redirected to "/"
      // still ran the action it carried. A GET still gets sent to the landing
      // page; anything else is simply refused.
      if (req.method !== "GET" && req.method !== "HEAD") {
        return new NextResponse(null, { status: 404 });
      }
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

  if (!host || platformHosts().has(host)) {
    // x-ensemble-domain is how /domain/[host] recognises a proxy rewrite. It is
    // stamped below, but a client can send a header by the same name, and on
    // this path the request was being forwarded verbatim — so a platform URL
    // plus one header rendered a creator's page at a second address and, worse,
    // stamped "we heard from your domain" on their setup checklist.
    const clean = new Headers(req.headers);
    clean.delete("x-ensemble-domain");
    return NextResponse.next({ request: { headers: clean } });
  }

  const url = req.nextUrl.clone();
  url.pathname = `/domain/${host}`;
  // Marks the request as proxy-rewritten so /domain/[host] can refuse
  // direct hits on the platform URL.
  const headers = new Headers(req.headers);
  headers.delete("x-ensemble-domain");
  headers.set("x-ensemble-domain", host);
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  // Skip API routes, Next internals and the embed/pairing scripts — those must
  // behave the same on every host. Every other path on a custom domain (any
  // path at all) serves the creator's page.
  matcher: ["/((?!api/|_next/|favicon\\.ico|embed\\.js|connect\\.js).*)"],
};
