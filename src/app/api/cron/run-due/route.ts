import { runDueWork } from "@/lib/scheduler";

/**
 * The tick that makes scheduling real.
 *
 * Cron on the droplet curls this every minute. Nothing else calls it, and it
 * is reachable from the open internet like every other route here, so it is
 * behind a shared secret compared in constant time - the same arrangement the
 * live relay hooks use, for the same reason.
 *
 * Unset CRON_SECRET disables the endpoint rather than opening it. An install
 * that has not configured scheduling should answer 404 to a prober, not run
 * work for one.
 *
 * Env:
 *   CRON_SECRET   shared secret, sent as x-cron-secret
 */

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!secret || given.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/**
 * POST, not GET. The work is not idempotent in the way a GET promises, and
 * anything that follows links in a page - a scanner, a prefetch, a preview
 * bot - must not be able to trigger a send by fetching a URL.
 */
export async function POST(req: Request): Promise<Response> {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

  // 404 rather than 401 when it is switched off: an unconfigured install
  // should not confirm that this route exists at all.
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: "Not found" }, { status: 404, headers });
  }
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const summary = await runDueWork();
    // The detail lines name post and newsletter ids and their outcomes. They
    // go to the cron log on the droplet, which is why they carry no addresses.
    if (summary.detail.length > 0) {
      console.log("[cron] " + summary.detail.join(" | "));
    }
    return Response.json(
      { ok: true, posts: summary.posts, newsletters: summary.newsletters },
      { headers }
    );
  } catch (err) {
    // A thrown run means the claim itself failed - the database is unreachable
    // or the schema is wrong. Individual items never reach here; the runner
    // catches those one at a time.
    console.error("[cron] run failed:", err);
    return Response.json({ ok: false }, { status: 500, headers });
  }
}
