import type { Metadata } from "next";
import { getSections, getSiteBySlug } from "./db";

/**
 * Tab title and icon for a creator page.
 *
 * Shared by the root /[slug] route and the /demo showcase so both announce the
 * creator rather than inheriting the root layout's Ensemble metadata.
 */
export function creatorMetadata(slug: string): Metadata {
  const site = getSiteBySlug(slug);
  if (!site) return {};
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
