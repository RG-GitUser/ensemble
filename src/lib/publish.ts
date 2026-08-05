import "server-only";
import { getPendingTargets, getPostForSite, getSocialAccountAuth, updateTargetStatus } from "./db";
import type { SocialAccountAuth } from "./types";

export interface PublishResult {
  status: "posted" | "queued" | "failed";
  /** Post URL when posted; error or waiting reason otherwise. */
  detail: string;
}

const posted = (detail: string): PublishResult => ({ status: "posted", detail });
const queued = (detail: string): PublishResult => ({ status: "queued", detail });
const failed = (detail: string): PublishResult => ({ status: "failed", detail });

/** Attempt delivery of every not-yet-posted target of a post. */
export async function publishPost(siteId: number, postId: number): Promise<void> {
  const post = getPostForSite(siteId, postId);
  if (!post) return;
  const text = post.mediaUrl ? `${post.body}\n${post.mediaUrl}` : post.body;

  for (const target of getPendingTargets(siteId, postId)) {
    const account = getSocialAccountAuth(siteId, target.platform);
    let result: PublishResult;
    if (!account) {
      result = failed("Account is no longer connected.");
    } else {
      try {
        result = await publishTo(account, text);
      } catch (e) {
        result = failed(e instanceof Error ? e.message : "Publishing failed.");
      }
    }
    updateTargetStatus(target.id, result.status, result.detail);
  }
}

async function publishTo(account: SocialAccountAuth, text: string): Promise<PublishResult> {
  switch (account.platform) {
    case "bluesky":
      return postBluesky(account, text);
    case "discord":
      return postDiscord(account, text);
    case "threads":
      return account.authKind === "oauth"
        ? postThreads(account, text)
        : queued("Reconnect Threads with one-click OAuth to publish for real.");
    case "instagram":
      return queued("Instagram publishing needs Ensemble's Meta app credentials (and posts require media).");
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

async function postThreads(account: SocialAccountAuth, text: string): Promise<PublishResult> {
  const create = await fetch(
    `${THREADS_GRAPH}/${account.externalId}/threads?media_type=TEXT&text=${encodeURIComponent(text.slice(0, 500))}&access_token=${encodeURIComponent(account.secret)}`,
    { method: "POST", signal: AbortSignal.timeout(20_000) }
  );
  if (!create.ok) return failed(`Threads container failed (HTTP ${create.status}) — token may have expired; reconnect.`);
  const { id } = (await create.json()) as { id: string };
  const publish = await fetch(
    `${THREADS_GRAPH}/${account.externalId}/threads_publish?creation_id=${encodeURIComponent(id)}&access_token=${encodeURIComponent(account.secret)}`,
    { method: "POST", signal: AbortSignal.timeout(20_000) }
  );
  if (!publish.ok) return failed(`Threads publish failed (HTTP ${publish.status}).`);
  return posted(`https://threads.net/@${account.handle}`);
}
