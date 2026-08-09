import { notFound } from "next/navigation";
import { getSiteBySlug } from "@/lib/db";
import { PublicSite } from "@/components/PublicSite";

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
