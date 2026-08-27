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
 * Instagram is deliberately absent: it has no official third-party RTMP
 * ingest, and pushing at reverse-engineered endpoints breaks without warning
 * mid-stream — worse than not offering it.
 */
export function pushTargets(config: SiteConfig): PushTarget[] {
  const targets: PushTarget[] = [];
  if (config.twitchStreamKey) {
    targets.push({ platform: "twitch", url: `rtmp://live.twitch.tv/app/${config.twitchStreamKey}` });
  }
  if (config.youtubeStreamKey) {
    targets.push({ platform: "youtube", url: `rtmp://a.rtmp.youtube.com/live2/${config.youtubeStreamKey}` });
  }
  if (config.facebookStreamKey) {
    targets.push({ platform: "facebook", url: `rtmps://live-api-s.facebook.com:443/rtmp/${config.facebookStreamKey}` });
  }
  return targets;
}
