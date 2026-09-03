import { healthCheck } from "@/lib/db";

/**
 * Liveness for an uptime monitor.
 *
 * Deliberately touches the database: the failure worth catching is not "the
 * process exited" — systemd restarts it, forever, without telling anyone — but
 * "the process is up and answering every request with a 500". Returns no
 * detail, because it is reachable from the internet.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    healthCheck();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
