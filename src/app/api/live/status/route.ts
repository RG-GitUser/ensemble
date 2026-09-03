import { revalidatePath } from "next/cache";
import { getSiteByIngestKey, patchSiteConfig } from "@/lib/db";
import { hookAuthorized } from "@/lib/live";
import { getPlan } from "@/lib/plans";

/**
 * The relay saw a stream start or stop — flip the on-air badge to match.
 * Only the badge: the social announcement stays behind the creator's own
 * "Announce I'm live" press, because a test stream from OBS should not post
 * to every platform they have.
 */
export async function POST(req: Request): Promise<Response> {
  if (!hookAuthorized(req)) return new Response(null, { status: 401 });

  const body = (await req.json().catch(() => null)) as { key?: string; live?: boolean } | null;
  if (!body || typeof body.key !== "string" || typeof body.live !== "boolean") {
    return new Response(null, { status: 400 });
  }

  const site = getSiteByIngestKey(body.key);
  if (!site || !getPlan(site.plan).live) return new Response(null, { status: 404 });

  if ((site.config.liveNow === true) !== body.live) {
    patchSiteConfig(site.id, { liveNow: body.live });
    revalidatePath(`/${site.slug}`);
    revalidatePath("/dashboard/integrations");
  }
  return new Response(null);
}
