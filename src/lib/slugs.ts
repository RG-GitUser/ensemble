/**
 * Creator pages live at the root of the platform — ensemble.it.com/nova-rae,
 * not /s/nova-rae — so a slug now shares a namespace with every platform
 * route. This is the list that keeps them apart.
 *
 * Two rules:
 *
 * 1. Anything that is (or could become) a top-level path has to be in here.
 *    A static route always wins over the dynamic [slug] segment, so a creator
 *    who took "login" wouldn't get a broken page — they'd get a page nobody
 *    could ever reach, which is worse because it fails silently.
 * 2. This module stays pure data. The proxy runs in middleware and imports it
 *    to decide what to let through, so it must not reach for the database or
 *    anything Node-only.
 *
 * Slugs already in the database are NOT retroactively invalidated — the check
 * runs when a slug is chosen or edited, so nobody's live URL breaks because
 * we added a marketing page.
 */

/** Paths that exist today — keep in step with the app/ directory. */
const ROUTES = [
  "admin",
  "api",
  "connect.js",
  "dashboard",
  "demo",
  "documents",
  "domain",
  "embed-demo",
  "embed.js",
  "forgot",
  "login",
  "onboarding",
  "privacy",
  "recover",
  "reset",
  "s",
  "signup",
  "terms",
  "verify-backup",
];

/** Next.js internals and web-standard files served from the root. */
const WELL_KNOWN = [
  "_next",
  "_vercel",
  ".well-known",
  "apple-touch-icon.png",
  "browserconfig.xml",
  "favicon.ico",
  "manifest.json",
  "robots.txt",
  "service-worker.js",
  "sitemap.xml",
];

/** Paths we haven't built yet but would want back. */
const FUTURE = [
  "about",
  "account",
  "affiliates",
  "auth",
  "billing",
  "blog",
  "brand",
  "careers",
  "changelog",
  "checkout",
  "community",
  "contact",
  "cookies",
  "developers",
  "docs",
  "download",
  "enterprise",
  "explore",
  "faq",
  "features",
  "feedback",
  "forgot",
  "guides",
  "help",
  "home",
  "integrations",
  "invite",
  "jobs",
  "legal",
  "logout",
  "media",
  "new",
  "news",
  "partners",
  "press",
  "pricing",
  "profile",
  "refer",
  "register",
  "reset",
  "roadmap",
  "search",
  "security",
  "settings",
  "signin",
  "signout",
  "status",
  "support",
  "team",
  "tour",
  "upgrade",
  "verify",
];

/** Infrastructure-flavoured names that shouldn't be a public page. */
const INFRA = [
  "assets",
  "cdn",
  "files",
  "ftp",
  "img",
  "images",
  "mail",
  "ns1",
  "ns2",
  "public",
  "smtp",
  "static",
  "uploads",
  "webhook",
  "webhooks",
  "www",
];

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([...ROUTES, ...WELL_KNOWN, ...FUTURE, ...INFRA]);

/**
 * Is this slug off limits? Also rejects anything with a dot in it, which
 * would otherwise let a page masquerade as a file (`nova.json`) and collide
 * with a future static asset.
 */
export function isReservedSlug(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  return RESERVED_SLUGS.has(s) || s.includes(".");
}
