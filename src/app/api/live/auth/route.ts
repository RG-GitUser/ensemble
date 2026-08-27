import { getSiteByIngestKey } from "@/lib/db";
import { liveHookSecret, pathIngestKey } from "@/lib/live";
import { getPlan } from "@/lib/plans";

/**
 * MediaMTX's HTTP authentication endpoint (`authHTTPAddress`). It POSTs a
 * JSON description of every connection attempt; 2xx lets it through and
 * anything else refuses. MediaMTX cannot attach custom headers here, so this
 * route takes no secret — it only ever answers yes/no about an ingest key,
 * mutates nothing, and refusal is the default at every exit.
 */

interface AuthRequest {
  ip?: string;
  action?: string;
  path?: string;
}

const deny = () => new Response(null, { status: 401 });

export async function POST(req: Request): Promise<Response> {
  // No secret configured means the relay isn't set up — nothing may stream.
  if (!liveHookSecret()) return deny();

  const body = (await req.json().catch(() => null)) as AuthRequest | null;
  if (!body) return deny();
  const { ip = "", action = "", path = "" } = body;

  // The ffmpeg forwarders read the stream back from MediaMTX over loopback.
  // Nobody else gets to watch the raw ingest — viewers watch on the platforms.
  if (action === "read" || action === "playback") {
    return ip === "127.0.0.1" || ip === "::1" ? new Response(null) : deny();
  }

  if (action !== "publish") return deny();

  const site = getSiteByIngestKey(pathIngestKey(path));
  if (!site || !getPlan(site.plan).live) return deny();
  return new Response(null);
}
