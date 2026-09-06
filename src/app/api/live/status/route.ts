import { revalidatePath } from "next/cache";
import { addLiveUsage, getSiteByIngestKey, patchSiteConfig } from "@/lib/db";
import { egressMonth, hookAuthorized } from "@/lib/live";
import { planFor } from "@/lib/billing";

/**
 * The relay saw a stream start or stop — flip the on-air badge to match, and
 * bank the egress the stream just spent.
 *
 * Only the badge: the social announcement stays behind the creator's own
 * "Announce I'm live" press, because a test stream from OBS should not post
 * to every platform they have.
 *
 * `bytes` arrives on the closing call, where the relay knows what each ffmpeg
 * actually wrote. It is optional and advisory — an older relay, a crash that
 * skips the trap, or a kill -9 all mean no report, and under-counting a
 * stream is a far better failure than refusing to mark someone offline.
 */
export async function POST(req: Request): Promise<Response> {
  if (!hookAuthorized(req)) return new Response(null, { status: 401 });

  const body = (await req.json().catch(() => null)) as { key?: string; live?: boolean; bytes?: unknown } | null;
  if (!body || typeof body.key !== "string" || typeof body.live !== "boolean") {
    return new Response(null, { status: 400 });
  }

  const site = getSiteByIngestKey(body.key);
  if (!site || !planFor(site).live) return new Response(null, { status: 404 });

  if (typeof body.bytes === "number") {
    addLiveUsage(site.id, egressMonth(), body.bytes);
  }

  if ((site.config.liveNow === true) !== body.live) {
    // patchSiteConfig, not updateSite with a spread of the config we read
    // above. This was the last call site still doing the read-modify-write,
    // and it is the one the pattern was found in: MediaMTX posts live:true
    // while a theme save is midway through its image pipeline, the theme save
    // finishes and writes back its pre-await snapshot, and liveNow reverts to
    // false. The relay only posts on state CHANGE, so it never corrects it —
    // the creator streams for an hour with the badge dark.
    patchSiteConfig(site.id, { liveNow: body.live });
    revalidatePath(`/${site.slug}`);
    revalidatePath("/dashboard/integrations");
  }
  return new Response(null);
}
