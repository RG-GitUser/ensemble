import { getLiveUsage, getSiteByIngestKey } from "@/lib/db";
import { egressAllowance, egressExceeded, egressMonth, hookAuthorized, pushTargets } from "@/lib/live";
import { planFor } from "@/lib/billing";

/**
 * Where should this stream be pushed? Called by deploy/live-push.sh the
 * moment a stream starts. The response contains full RTMP URLs with the
 * creator's stream keys embedded, which is why the hook secret is required —
 * the ingest key alone must not be enough to read someone's stream keys back
 * out.
 *
 * This is also where the monthly egress allowance is enforced, because it is
 * the one point where the relay asks permission rather than announcing what it
 * has done. Refusing here costs the platform nothing; there is no equivalent
 * moment later.
 *
 * `overQuota` is reported separately from an empty target list on purpose. The
 * relay treats "no destinations saved" and "the app didn't answer" as
 * different situations, and this is a third — the creator has destinations and
 * is being declined. Collapsing it into an empty list would put a lit on-air
 * badge over silence with nothing in the log to explain it.
 */
export function GET(req: Request): Response {
  if (!hookAuthorized(req)) return new Response(null, { status: 401 });

  const key = new URL(req.url).searchParams.get("key") ?? "";
  const site = getSiteByIngestKey(key);
  const plan = site ? planFor(site) : null;
  if (!site || !plan?.live) return new Response(null, { status: 404 });

  const month = egressMonth();
  const used = getLiveUsage(site.id, month);
  const allowance = egressAllowance(plan.liveEgressBytes);

  if (egressExceeded(used, allowance)) {
    return Response.json({ targets: [], overQuota: true, used, allowance, month });
  }

  return Response.json({ targets: pushTargets(site.config), used, allowance, month });
}
