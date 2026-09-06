import { healthCheck } from "@/lib/db";

/**
 * Liveness and readiness in one.
 *
 * There was no health route at all, so nothing outside the box could tell "up"
 * from "up and returning 500 to everyone" — and with Restart=always and a
 * three-second delay, a crash loop never trips systemd's rate limiter and runs
 * forever unnoticed. Point an uptime check at this.
 *
 * Deliberately thin: it touches the database (the one dependency whose failure
 * is invisible from outside) and reports nothing an outsider could use. No
 * version, no counts, no configuration.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  try {
    healthCheck();
    return Response.json({ status: "ok" }, { headers });
  } catch (err) {
    console.error("[health] database check failed:", err);
    return Response.json({ status: "error" }, { status: 503, headers });
  }
}
