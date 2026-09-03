import type { Metadata } from "next";
import { billingOk } from "./billing";
import { getSections, getSiteBySlug } from "./db";

/**
 * Tab title and icon for a creator page.
 *
 * Shared by the root /[slug] route and the /demo showcase so both announce the
 * creator rather than inheriting the root layout's Ensemble metadata.
 *
 * Gated the same way the body is: generateMetadata runs before the page
 * component decides to refuse, so an unpublished site used to answer with its
 * real headline and tagline in the title and description while the body said
 * the page wasn't live yet.
 */
export function creatorMetadata(slug: string): Metadata {
  const site = getSiteBySlug(slug);
  if (!site || !site.published || !billingOk(site)) return {};
  const hero = getSections(site.id).find((s) => s.type === "hero");
  const icon = site.config.faviconUrl;
  return {
    title: hero?.content.heading || site.slug,
    description: site.config.tagline || hero?.content.subheading || "",
    // Omit entirely when unset so Next falls back to the default icon rather
    // than emitting a link to nothing.
    ...(icon ? { icons: { icon, shortcut: icon, apple: icon } } : {}),
  };
}
