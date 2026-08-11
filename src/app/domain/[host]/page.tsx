import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSections, getSiteById, resolveDomain, touchDomain } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { PublicSite } from "@/components/PublicSite";
import type { Metadata } from "next";
import type { Site } from "@/lib/types";

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
  if (!site || !getPlan(site.plan).customDomain) return null;
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
  // Any request that lands here proves DNS points at us — reflected as
  // "Connected" in the dashboard's domain card.
  touchDomain(site.id);
  return <PublicSite site={site} />;
}
