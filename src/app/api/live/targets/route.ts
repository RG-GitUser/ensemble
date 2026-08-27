import { getSiteByIngestKey } from "@/lib/db";
import { hookAuthorized, pushTargets } from "@/lib/live";
import { getPlan } from "@/lib/plans";

/**
 * Where should this stream be pushed? Called by deploy/live-push.sh the
 * moment a stream starts. The response contains full RTMP URLs with the
 * creator's stream keys embedded, which is why the hook secret is required —
 * the ingest key alone must not be enough to read someone's stream keys back
 * out.
 */
export function GET(req: Request): Response {
  if (!hookAuthorized(req)) return new Response(null, { status: 401 });

  const key = new URL(req.url).searchParams.get("key") ?? "";
  const site = getSiteByIngestKey(key);
  if (!site || !getPlan(site.plan).live) return new Response(null, { status: 404 });

  return Response.json({ targets: pushTargets(site.config) });
}
