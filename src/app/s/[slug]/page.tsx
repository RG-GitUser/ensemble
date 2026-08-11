import { notFound } from "next/navigation";
import { getSections, getSiteBySlug } from "@/lib/db";
import { PublicSite } from "@/components/PublicSite";
import type { Metadata } from "next";

/**
 * Without this the tab inherited the root layout's metadata, so every
 * creator page announced itself as Ensemble. A creator page should carry the
 * creator's name and their own tab icon.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
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

export default async function PublicSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const site = getSiteBySlug(slug);
  if (!site) notFound();
  return <PublicSite site={site} preview={!!preview} />;
}
