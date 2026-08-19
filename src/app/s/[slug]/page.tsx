import { permanentRedirect } from "next/navigation";

/**
 * Creator pages moved from /s/<slug> to /<slug>. This is the old address,
 * kept permanently: these links are pasted into bios, printed on merch and
 * shared in DMs, so they have to keep resolving indefinitely. A 308 also
 * tells crawlers and clients where the page really lives now.
 */
export default async function LegacyCreatorPageRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  // ?preview=1 is how the dashboard opens an unpublished page — carry the
  // whole query through so an old preview link still previews.
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((one) => qs.append(k, one));
    else if (v !== undefined) qs.set(k, v);
  }
  const query = qs.toString();
  permanentRedirect(`/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`);
}
