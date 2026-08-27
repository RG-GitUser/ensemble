import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteBySlug } from "@/lib/db";
import { creatorMetadata } from "@/lib/publicsite";
import { PublicSite } from "@/components/PublicSite";

/**
 * The seeded example page. It needs its own route because /demo/dashboard
 * already claims the "demo" segment, and a static segment never falls through
 * to the dynamic [slug] one — without this, /demo would 404.
 */
export function generateMetadata(): Metadata {
  return creatorMetadata("demo");
}

export default function DemoSitePage() {
  const site = getSiteBySlug("demo");
  if (!site) notFound();
  return <PublicSite site={site} />;
}
