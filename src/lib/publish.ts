import "server-only";
import {
  getPendingTargets,
  getPostForSite,
  getSocialAccountAuth,
  updateTargetStatus,
  upsertSocialAccount,
} from "./db";
import { getOAuthProvider, parseExpiry, providerCredentials } from "./oauth";
import { refreshAccessToken } from "./oauth-connect";
import { getPlatform } from "./social";
import type { SocialAccountAuth } from "./types";

const TIMEOUT = 20_000;

export interface PublishResult {
  status: "posted" | "queued" | "failed";
  /** Post URL when posted; error or waiting reason otherwise. */
  detail: string;
}

const posted = (detail: string): PublishResult => ({ status: "posted", detail });
const queued = (detail: string): PublishResult => ({ status: "queued", detail });
const failed = (detail: string): PublishResult => ({ status: "failed", detail });

/** Attempt delivery of every not-yet-posted target of a post. */
export interface PublishOutcome {
  platform: string;
  ok: boolean;
  detail: string;
}

/**
 * Push a post to each of its pending targets, and REPORT what happened.
 *
 * This used to return void, so createSocialPostAction returned { ok: true }
 * unconditionally and retrySocialPost returned nothing at all: with an expired
 * token the compose form said the post had gone out when nothing had been
 * published anywhere. The only signal was a `title=` tooltip on a status pip,
 * which is invisible on touch.
 */
export async function publishPost(siteId: number, postId: number): Promise<PublishOutcome[]> {
  const outcomes: PublishOutcome[] = [];
  const post = getPostForSite(siteId, postId);
  if (!post) return outcomes;
  // Platforms with a first-class media field get body and mediaUrl separately;
  // the text-only ones get them flattened, exactly as before.
  const content: PostContent = {
    text: post.mediaUrl ? `${post.body}\n${post.mediaUrl}` : post.body,
    body: post.body,
    mediaUrl: post.mediaUrl,
  };

  for (const target of getPendingTargets(siteId, postId)) {
    const account = getSocialAccountAuth(siteId, target.platform);
    let result: PublishResult;
    if (!account) {
      result = failed("Account is no longer connected.");
    } else {
      try {
        result = await publishTo(account, await freshToken(siteId, account), content);
      } catch (e) {
        result = failed(e instanceof Error ? e.message : "Publishing failed.");
      }
    }
    updateTargetStatus(target.id, result.status, result.detail);
    outcomes.push({ platform: target.platform, ok: result.status === "posted", detail: result.detail });
  }
  return outcomes;
}

/** One line a creator can act on: which platforms went out, which didn't, why. */
export function summarisePublish(outcomes: PublishOutcome[]): { ok: boolean; message: string } {
  if (outcomes.length === 0) return { ok: false, message: "Nothing was queued to post." };
  const posted = outcomes.filter((o) => o.ok);
  const failedTargets = outcomes.filter((o) => !o.ok);
  if (failedTargets.length === 0) {
    return { ok: true, message: `Posted to ${posted.length} platform${posted.length === 1 ? "" : "s"}.` };
  }
  const names = failedTargets.map((f) => f.platform).join(", ");
  const why = failedTargets[0].detail ? ` — ${failedTargets[0].detail}` : "";
  return {
    ok: false,
    message: `Posted to ${posted.length} of ${outcomes.length}. Failed: ${names}${why}`,
  };
}

/** One post, in the shapes the different APIs want it. */
interface PostContent {
  /** body with any media URL appended — for platforms with no media field. */
  text: string;
  body: string;
  mediaUrl: string;
}

/**
 * In-flight token refreshes, keyed by site and platform.
 *
 * Pinned to globalThis for the same reason the rate limiter is: Next compiles
 * server actions and route handlers into separate bundles, and a plain
 * module-level Map would give each entry point its own copy — which is exactly
 * the race this exists to prevent.
 */
const refreshLocks: Map<string, Promise<string>> = ((globalThis as typeof globalThis & {
  __ensembleRefreshLocks?: Map<string, Promise<string>>;
}).__ensembleRefreshLocks ??= new Map());

/**
 * The stored access token, refreshed first if it is spent or nearly so.
 *
 * Falls back to the stored token whenever a refresh isn't possible, so a
 * platform that doesn't use this grant behaves exactly as it did before.
 */
async function freshToken(siteId: number, account: SocialAccountAuth): Promise<string> {
  if (account.authKind !== "oauth" || !account.refreshToken || !account.expiresAt) return account.secret;

  const ms = parseExpiry(account.expiresAt);
  // Five minutes of headroom — a token that dies mid-publish reads as a failure.
  if (Number.isNaN(ms) || ms - Date.now() > 5 * 60_000) return account.secret;

  // One refresh at a time per account.
  //
  // Two posts to the same platform landing together both saw an expiring
  // token and both refreshed. For providers that ROTATE the refresh token
  // (Pinterest), the second exchange retires the first one's result, so
  // whichever write lands last stores an already-dead refresh token and the
  // account silently stops being refreshable. Sharing one in-flight promise
  // makes concurrent callers wait for the same answer instead of racing.
  const key = `${siteId}:${account.platform}`;
  const existing = refreshLocks.get(key);
  if (existing) return existing;

  const run = (async () => {
    const provider = getOAuthProvider(account.platform);
    const creds = provider ? providerCredentials(provider) : null;
    if (!provider || !creds) return account.secret;

    const next = await refreshAccessToken(provider, creds, account.refreshToken);
    if (!next) return account.secret;

    upsertSocialAccount(siteId, account.platform, account.handle, {
      authKind: "oauth",
      secret: next.accessToken,
      refreshToken: next.refreshToken,
      expiresAt: next.expiresAt,
      externalId: account.externalId,
    });
    return next.accessToken;
  })().finally(() => refreshLocks.delete(key));

  refreshLocks.set(key, run);
  return run;
}

/** Reddit and Pinterest need a title; the first non-empty line is it. */
function firstLine(body: string): string {
  return (body.split("\n").find((l) => l.trim()) ?? "").trim();
}

/** Connected by handle only — there is no token to post with. */
function needsOAuth(platform: string): PublishResult {
  const name = getPlatform(platform)?.name ?? platform;
  return queued(`Reconnect ${name} with one-click OAuth to publish for real.`);
}

async function publishTo(account: SocialAccountAuth, token: string, content: PostContent): Promise<PublishResult> {
  const oauth = account.authKind === "oauth";
  switch (account.platform) {
    case "bluesky":
      return postBluesky(account, content.text);
    case "discord":
      return postDiscord(account, content.text);
    case "threads":
      return oauth ? postThreads(account, token, content.text) : needsOAuth(account.platform);
    case "instagram":
      return oauth ? postInstagram(account, token, content) : needsOAuth(account.platform);
    case "facebook":
      return oauth ? postFacebook(account, token, content) : needsOAuth(account.platform);
    case "pinterest":
      return oauth ? postPinterest(account, token, content) : needsOAuth(account.platform);
    case "reddit":
      return oauth ? postReddit(account, token, content) : needsOAuth(account.platform);
    case "tiktok":
      return queued("TikTok publishing needs Ensemble's TikTok app credentials (video/photo posts only).");
    default:
      return queued("Direct publishing for this platform arrives with its API credentials.");
  }
}

/* ---------------- Bluesky (AT Protocol — open API, app-password auth) ---------------- */

const BSKY = "https://bsky.social/xrpc";

/** Throws with a readable message on bad credentials. */
export async function blueskySession(handle: string, appPassword: string): Promise<{ accessJwt: string; did: string }> {
  const res = await fetch(`${BSKY}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`Bluesky sign-in failed: ${err?.message ?? `HTTP ${res.status}`}`);
  }
  return (await res.json()) as { accessJwt: string; did: string };
}

async function postBluesky(account: SocialAccountAuth, text: string): Promise<PublishResult> {
  const session = await blueskySession(account.handle, account.secret);
  const res = await fetch(`${BSKY}/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: { $type: "app.bsky.feed.post", text: text.slice(0, 300), createdAt: new Date().toISOString() },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return failed(`Bluesky rejected the post (HTTP ${res.status}).`);
  const { uri } = (await res.json()) as { uri: string };
  const rkey = uri.split("/").pop();
  return posted(`https://bsky.app/profile/${account.handle}/post/${rkey}`);
}

/* ---------------- Discord (incoming webhook) ---------------- */

async function postDiscord(account: SocialAccountAuth, text: string): Promise<PublishResult> {
  const res = await fetch(account.secret, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text.slice(0, 2000) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return failed(`Discord webhook rejected the post (HTTP ${res.status}).`);
  return posted("Delivered to the Discord channel.");
}

/* ---------------- Threads (Meta Graph API — needs THREADS_APP_ID/SECRET + OAuth) ---------------- */

const THREADS_GRAPH = "https://graph.threads.net/v1.0";

/**
 * Access tokens go in the Authorization header, never the query string.
 *
 * A URL is recorded in a way a header is not: intermediary proxies, the
 * provider's own access logs, and anything that captures a request line all
 * keep the full URL, so `?access_token=…` writes a live credential into logs
 * neither we nor the creator control. Every Meta Graph endpoint used here
 * accepts a bearer token instead.
 */
function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function postThreads(account: SocialAccountAuth, token: string, text: string): Promise<PublishResult> {
  const create = await fetch(
    `${THREADS_GRAPH}/${account.externalId}/threads?media_type=TEXT&text=${encodeURIComponent(text.slice(0, 500))}`,
    { method: "POST", headers: bearer(token), signal: AbortSignal.timeout(20_000) }
  );
  if (!create.ok) return failed(`Threads container failed (HTTP ${create.status}) — token may have expired; reconnect.`);
  const { id } = (await create.json()) as { id: string };
  const publish = await fetch(
    `${THREADS_GRAPH}/${account.externalId}/threads_publish?creation_id=${encodeURIComponent(id)}`,
    { method: "POST", headers: bearer(token), signal: AbortSignal.timeout(20_000) }
  );
  if (!publish.ok) return failed(`Threads publish failed (HTTP ${publish.status}).`);
  return posted(`https://threads.net/@${account.handle}`);
}

/* ---------------- Instagram (Graph API — image or video container, then publish) ---------------- */

const IG_GRAPH = "https://graph.instagram.com/v21.0";

async function postInstagram(account: SocialAccountAuth, token: string, c: PostContent): Promise<PublishResult> {
  // Instagram has no text-only post type; without media there is nothing to send.
  if (!c.mediaUrl) return failed("Instagram posts need an image — add a media URL to this post and retry.");

  const create = new URL(`${IG_GRAPH}/${account.externalId}/media`);
  create.searchParams.set("image_url", c.mediaUrl);
  create.searchParams.set("caption", c.body.slice(0, 2200));
  const made = await fetch(create, { method: "POST", headers: bearer(token), signal: AbortSignal.timeout(30_000) });
  if (!made.ok)
    return failed(
      `Instagram wouldn't accept the image (HTTP ${made.status}) — check the URL is public, or reconnect if the token expired.`
    );
  const { id } = (await made.json()) as { id: string };

  const publish = new URL(`${IG_GRAPH}/${account.externalId}/media_publish`);
  publish.searchParams.set("creation_id", id);
  const done = await fetch(publish, { method: "POST", headers: bearer(token), signal: AbortSignal.timeout(30_000) });
  if (!done.ok) return failed(`Instagram publish failed (HTTP ${done.status}).`);
  return posted(`https://instagram.com/${account.handle}`);
}

/* ---------------- Facebook Pages (Graph API — needs the Page's own token) ---------------- */

const FB_GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Page posts are authored by the Page, not the person who authorized us, so
 * the user token has to be traded for the Page's token first. Posting with the
 * user token fails with a permissions error that reads like a scope problem.
 */
async function facebookPageToken(pageId: string, userToken: string): Promise<string | null> {
  const url = new URL(`${FB_GRAPH}/${pageId}`);
  url.searchParams.set("fields", "access_token");
  const res = await fetch(url, { headers: bearer(userToken), signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as { access_token?: string } | null;
  return typeof json?.access_token === "string" ? json.access_token : null;
}

async function postFacebook(account: SocialAccountAuth, token: string, c: PostContent): Promise<PublishResult> {
  const pageToken = await facebookPageToken(account.externalId, token);
  if (!pageToken)
    return failed("We couldn't get permission to post to your Page — reconnect Facebook and tick the Page on the permission screen.");

  // The page token moves to the header with the rest; the body carries only
  // the post itself.
  const body = new URLSearchParams({ message: c.body });
  if (c.mediaUrl) body.set("link", c.mediaUrl);
  const res = await fetch(`${FB_GRAPH}/${account.externalId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...bearer(pageToken) },
    body,
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) return failed(`Facebook rejected the post (HTTP ${res.status}).`);
  const { id } = (await res.json()) as { id: string };
  return posted(`https://facebook.com/${id}`);
}

/* ---------------- Pinterest (v5 — a pin needs an image and a board) ---------------- */

const PINTEREST = "https://api.pinterest.com/v5";

async function postPinterest(account: SocialAccountAuth, token: string, c: PostContent): Promise<PublishResult> {
  if (!c.mediaUrl) return failed("Every pin needs an image — add a media URL to this post and retry.");

  // No board picker exists yet, so the first board is the destination. The
  // result detail names it, so nobody has to guess where a pin landed.
  const list = await fetch(`${PINTEREST}/boards?page_size=1`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!list.ok) return failed(`Pinterest wouldn't list your boards (HTTP ${list.status}) — reconnect and try again.`);
  const { items } = (await list.json()) as { items?: Array<{ id?: string; name?: string }> };
  const board = items?.[0];
  if (!board?.id) return failed("Your Pinterest account has no boards yet — create one and retry.");

  const res = await fetch(`${PINTEREST}/pins`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      board_id: board.id,
      title: firstLine(c.body).slice(0, 100),
      description: c.body.slice(0, 800),
      media_source: { source_type: "image_url", url: c.mediaUrl },
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) return failed(`Pinterest rejected the pin (HTTP ${res.status}).`);
  const { id } = (await res.json()) as { id: string };
  return posted(`https://pinterest.com/pin/${id} (board: ${board.name ?? "your first board"})`);
}

/* ---------------- Reddit (profile self-posts — the one destination we can guarantee) ---------------- */

async function postReddit(account: SocialAccountAuth, token: string, c: PostContent): Promise<PublishResult> {
  const title = firstLine(c.body).slice(0, 300);
  if (!title) return failed("Reddit needs a title — the first line of your post is used as one.");

  const res = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Reddit rejects requests without a descriptive User-Agent.
      "User-Agent": "Ensemble/1.0",
    },
    body: new URLSearchParams({
      sr: `u_${account.handle}`,
      kind: "self",
      title,
      text: c.text,
      api_type: "json",
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) return failed(`Reddit rejected the post (HTTP ${res.status}).`);

  // Reddit answers 200 with the errors inside the body, so this has to be read.
  const json = (await res.json().catch(() => null)) as
    | { json?: { errors?: unknown[][]; data?: { url?: string } } }
    | null;
  const errors = json?.json?.errors ?? [];
  if (errors.length) return failed(`Reddit rejected the post: ${String(errors[0]?.[1] ?? "unknown reason")}.`);
  return posted(json?.json?.data?.url ?? `https://reddit.com/user/${account.handle}`);
}
