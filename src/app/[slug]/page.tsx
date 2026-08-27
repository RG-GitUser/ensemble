import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteBySlug } from "@/lib/db";
import { isReservedSlug } from "@/lib/slugs";
import { creatorMetadata } from "@/lib/publicsite";
import { PublicSite } from "@/components/PublicSite";

/**
 * Creator pages at the root of the platform: ensemble.it.com/nova-rae.
 *
 * Static routes win over this segment, so /login and /dashboard are never in
 * play here — but a reserved name can still arrive as a typo or a stale link,
 * and those 404 rather than hitting the database.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (isReservedSlug(slug)) return {};
  return creatorMetadata(slug);
}

export default async function CreatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  if (isReservedSlug(slug)) notFound();
  const site = getSiteBySlug(slug);
  if (!site) notFound();
  return <PublicSite site={site} preview={!!preview} />;
}
