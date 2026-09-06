import "server-only";
import type { SiteConfig } from "./types";

/**
 * The live relay: creators stream once to Ensemble and MediaMTX + ffmpeg on
 * the server push the same bytes to every platform they saved a stream key
 * for. This module is the app's half of that conversation — the relay's half
 * lives in deploy/mediamtx.yml and deploy/live-push.sh.
 *
 * Two env vars switch the whole feature on:
 * - LIVE_INGEST_URL   what creators point OBS at, e.g. rtmp://ensemble.it.com/live
 * - LIVE_HOOK_SECRET  shared secret the relay scripts present when they call
 *                     back into the app (targets lookup, live/offline flips)
 */

/** RTMP application name — the path prefix MediaMTX sees on every stream. */
export const INGEST_APP = "live";

/**
 * The month a stream's egress is charged to: 'YYYY-MM', always UTC.
 *
 * Deliberately not local time. The droplet's zone is not the creator's, and a
 * quota window that moves when someone changes TZ — or that rolls over at a
 * different instant than the one the next process assumes — hands out free
 * transfer twice a year at the boundary.
 */
export function egressMonth(at: Date = new Date()): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Bytes of relay egress a site may spend this month.
 *
 * Reads the plan, with LIVE_EGRESS_BYTES_PER_SITE as an override for boxes
 * whose transfer allowance differs from the one the plans were priced against
 * — the same escape hatch scripts/check-egress.sh offers for the box total.
 * A non-positive or unparseable override is ignored rather than obeyed: a typo
 * in an env var must not silently switch the quota off, and must not lock
 * every creator out either.
 */
export function egressAllowance(planEgressBytes: number): number {
  const raw = process.env.LIVE_EGRESS_BYTES_PER_SITE;
  if (raw !== undefined) {
    const override = Number(raw);
    if (Number.isFinite(override) && override > 0) return Math.floor(override);
  }
  return planEgressBytes;
}

/**
 * Has this site spent its month's relay allowance?
 *
 * An allowance of 0 means the plan does not include the relay at all, which
 * the caller has already refused on `live`; treated as "no headroom" here so
 * this can never be the thing that lets it through.
 */
export function egressExceeded(usedBytes: number, allowanceBytes: number): boolean {
  if (!Number.isFinite(usedBytes) || usedBytes < 0) return false;
  return usedBytes >= allowanceBytes;
}

export function liveIngestUrl(): string {
  return process.env.LIVE_INGEST_URL ?? "";
}

export function liveHookSecret(): string {
  return process.env.LIVE_HOOK_SECRET ?? "";
}

/** Both halves configured — the dashboard shows the ingest address only then. */
export function relayConfigured(): boolean {
  return !!liveIngestUrl() && !!liveHookSecret();
}

/**
 * Constant-ish comparison for the hook secret. These calls come from our own
 * relay scripts over loopback, but the routes are still reachable from the
 * open internet, so the check must not be an early-exit string compare.
 */
export function hookAuthorized(req: Request): boolean {
  const secret = liveHookSecret();
  const given = req.headers.get("x-live-secret") ?? "";
  if (!secret || given.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/**
 * MediaMTX path ("live/abc123") → ingest key ("abc123"). Anything outside the
 * live app, or nested deeper, is not ours and maps to "".
 */
export function pathIngestKey(path: string): string {
  const parts = path.split("/");
  if (parts.length !== 2 || parts[0] !== INGEST_APP || !parts[1]) return "";
  return parts[1];
}

export interface PushTarget {
  platform: string;
  /** Full RTMP(S) URL, stream key included — feed it to ffmpeg verbatim. */
  url: string;
}

/**
 * Where the relay pushes a site's stream, from the keys the creator saved.
 *
 * Every destination is rtmps://, never rtmp://. The stream key is embedded in
 * the URL, so a cleartext push publishes the creator's key to every hop
 * between this droplet and the platform — and that key is exactly the secret
 * that lets a stranger broadcast to their channel. Ingest was moved to RTMPS
 * for this reason; egress carries the same secret and needs the same
 * treatment. Twitch and YouTube both terminate TLS on 443 for these
 * hostnames, and the relay's ffmpeg already speaks rtmps to Facebook, so this
 * costs a handshake and nothing else.
 *
 * Instagram is deliberately absent: it has no official third-party RTMP
 * ingest, and pushing at reverse-engineered endpoints breaks without warning
 * mid-stream — worse than not offering it.
 */
export function pushTargets(config: SiteConfig): PushTarget[] {
  const targets: PushTarget[] = [];
  if (config.twitchStreamKey) {
    targets.push({ platform: "twitch", url: `rtmps://live.twitch.tv/app/${config.twitchStreamKey}` });
  }
  if (config.youtubeStreamKey) {
    targets.push({ platform: "youtube", url: `rtmps://a.rtmp.youtube.com/live2/${config.youtubeStreamKey}` });
  }
  if (config.facebookStreamKey) {
    targets.push({ platform: "facebook", url: `rtmps://live-api-s.facebook.com:443/rtmp/${config.facebookStreamKey}` });
  }
  return targets;
}
