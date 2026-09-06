import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSections, getSiteById, resolveDomain, touchDomain } from "@/lib/db";
import { billingOk, planFor } from "@/lib/billing";
import { PublicSite } from "@/components/PublicSite";
import type { Metadata } from "next";
import type { Site } from "@/lib/types";

/**
 * Rendering this page WRITES: recordPageView counts the visit, and on a custom
 * domain touchDomain stamps that DNS reached us. Both are side effects of a
 * render, which is why this route must never be cached — a cached render
 * serves the page and silently stops counting, and the creator's analytics
 * quietly flatline with nothing to show why.
 *
 * It is dynamic today because every read here is uncached; this makes that a
 * stated requirement rather than an accident that a later change could undo.
 * The honest fix is to move the write out of render into a beacon, which is a
 * bigger change than this note.
 */
export const dynamic = "force-dynamic";

/**
 * Serves creator pages on their own domains. Only reachable through the
 * proxy rewrite (which stamps x-ensemble-domain) — direct hits on the
 * platform URL 404 so the same page never exists at two platform paths.
 */
async function siteForHost(host: string): Promise<Site | null> {
  if ((await headers()).get("x-ensemble-domain") !== host) return null;
  const domain = resolveDomain(host);
  if (!domain) return null;
  const site = getSiteById(domain.siteId);
  // Downgrading below Pro switches the domain off, like other plan features.
  if (!site || !planFor(site).customDomain) return null;
  // Same gate the body applies. generateMetadata runs BEFORE the page, so
  // without this an unpublished or lapsed site still put its unreleased
  // headline and tagline into the tab title, search results and link previews
  // while the page itself refused to render.
  if (!site.published || !billingOk(site)) return null;
  return site;
}

export async function generateMetadata({ params }: { params: Promise<{ host: string }> }): Promise<Metadata> {
  const { host } = await params;
  const site = await siteForHost(host);
  if (!site) return {};
  // The creator's name, not Ensemble's — this is their domain.
  const hero = getSections(site.id).find((s) => s.type === "hero");
  const icon = site.config.faviconUrl;
  return {
    title: hero?.content.heading || site.slug,
    description: site.config.tagline || hero?.content.subheading || "",
    ...(icon ? { icons: { icon, shortcut: icon, apple: icon } } : {}),
  };
}

export default async function DomainPage({ params }: { params: Promise<{ host: string }> }) {
  const { host } = await params;
  const site = await siteForHost(host);
  if (!site) notFound();
  // NOTE: PublicSite renders a preview for the owner on a draft page, which
  // siteForHost now excludes. That is deliberate here — a custom domain is
  // public by definition, and the owner previews from the platform URL.
  // Any request that lands here proves DNS points at us — reflected as
  // "Connected" in the dashboard's domain card.
  touchDomain(site.id);
  return <PublicSite site={site} />;
}
