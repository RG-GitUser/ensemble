"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  connectSocial,
  createSocialPostAction,
  disconnectSocial,
  endLive,
  goLive,
  retrySocialPost,
  saveLiveStreams,
  type FormState,
} from "@/lib/actions";
import { getPlatform, iconFill, PLATFORMS, type PlatformDef } from "@/lib/social";
import type { SocialAccount, SocialPost } from "@/lib/types";

function PlatformIcon({ platform, size = 18 }: { platform: PlatformDef; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d={platform.iconPath} fill={iconFill(platform.color)} />
    </svg>
  );
}

/** Platforms whose credentials come from a single Meta developer app. */
const META_PLATFORMS = new Set(["threads", "instagram", "facebook"]);

function ConnectForm({ platform, oauthReady }: { platform: PlatformDef; oauthReady: string[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(connectSocial, {});

  if (platform.authType === "oauth" && oauthReady.includes(platform.id)) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <PlatformIcon platform={platform} />
        <a href={`/api/oauth/${platform.id}`} className="btn-primary !py-2 text-sm">
          Continue with {platform.name}
        </a>
        <p className="text-xs text-mist">One click — posts publish for real.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="platform" value={platform.id} />
      <PlatformIcon platform={platform} />
      {platform.authType === "bluesky" ? (
        <>
          <input name="handle" className="field flex-1 !py-2 text-sm" placeholder="you.bsky.social" autoFocus />
          <input
            name="secret"
            type="password"
            autoComplete="off"
            className="field flex-1 !py-2 font-mono text-xs"
            placeholder="app password (Settings → Privacy → App Passwords)"
          />
        </>
      ) : platform.authType === "webhook" ? (
        <input
          name="secret"
          className="field flex-1 !py-2 font-mono text-xs"
          placeholder="https://discord.com/api/webhooks/… (Server Settings → Integrations)"
          autoFocus
        />
      ) : (
        <input name="handle" className="field flex-1 !py-2 text-sm" placeholder={platform.placeholder} autoFocus />
      )}
      <button className="btn-primary !py-2 text-sm" disabled={pending}>
        {pending ? "…" : `Connect ${platform.name}`}
      </button>
      {platform.authType === "oauth" && (
        <p className="w-full text-xs text-mist/70">
          Handle-only for now — one-click connect &amp; real publishing unlock when Ensemble&apos;s{" "}
          {META_PLATFORMS.has(platform.id) ? "Meta" : platform.name} app credentials are added.
        </p>
      )}
      {(platform.authType === "bluesky" || platform.authType === "webhook") && (
        <p className="w-full text-xs text-good/80">Publishes for real — no platform approval needed.</p>
      )}
      {state.error && <p className="w-full text-xs text-brand2">{state.error}</p>}
    </form>
  );
}

function ConnectGrid({ accounts, oauthReady }: { accounts: SocialAccount[]; oauthReady: string[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const byPlatform = new Map(accounts.map((a) => [a.platform, a]));
  const selected = sel ? getPlatform(sel) : null;
  const selAccount = sel ? byPlatform.get(sel) : undefined;

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {PLATFORMS.map((p) => {
          const connected = byPlatform.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSel(sel === p.id ? null : p.id)}
              title={connected ? `Connected as ${byPlatform.get(p.id)?.handle}` : `Connect ${p.name}`}
              className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] font-medium transition ${
                sel === p.id
                  ? "border-brand bg-brand/10"
                  : connected
                    ? "border-good/40 bg-good/5"
                    : "border-edge bg-panel2 hover:border-brand/40"
              }`}
            >
              <PlatformIcon platform={p} />
              <span className="truncate">{p.name}</span>
              <span className={`h-1 w-1 rounded-full ${connected ? "bg-good" : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
      {selected && !selAccount && <ConnectForm platform={selected} oauthReady={oauthReady} />}
      {selected && selAccount && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <PlatformIcon platform={selected} />
          <a
            href={selected.profileUrl(selAccount.handle)}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-good hover:underline"
          >
            @{selAccount.handle.replace(/^@/, "")}
          </a>
          <span className="rounded-full bg-panel2 px-2 py-0.5 text-[10px] font-bold uppercase text-mist">
            {selAccount.authKind === "handle" ? "handle only" : "publishes"}
          </span>
          <form action={disconnectSocial}>
            <input type="hidden" name="platform" value={selected.id} />
            <button className="text-xs font-semibold text-mist transition hover:text-brand2">Disconnect</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Composer({ accounts }: { accounts: SocialAccount[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createSocialPostAction, {});
  return (
    <form action={formAction} className="mt-4">
      <textarea name="body" maxLength={2000} className="field min-h-20 text-sm" placeholder="What's happening?" required />
      <input name="mediaUrl" className="field mt-2 font-mono text-xs" placeholder="Image or video link (optional) — https://…" />
      {/* No per-platform picker: posts go everywhere you're connected, and the
          Integrations connect grid is already the source of truth for what that is. */}
      {accounts.length === 0 && (
        <p className="mt-3 text-xs text-warn">
          <Link href="/dashboard/integrations" className="underline">Connect a platform in Integrations</Link> to start posting.
        </p>
      )}
      {state.error && (
        <p className="mt-3 rounded-xl border border-brand2/40 bg-brand2/10 px-3 py-2 text-sm text-brand2">{state.error}</p>
      )}
      {state.ok && <p className="mt-3 text-sm font-semibold text-good">Post queued for every connected platform.</p>}
      <div className="mt-3 flex items-center gap-3">
        <button className="btn-primary !py-2 text-sm" disabled={pending || accounts.length === 0}>
          {pending ? "Posting…" : "Post everywhere"}
        </button>
        <p className="text-xs text-mist/70">
          Bluesky and Discord publish for real with no approval. Threads, Instagram, Facebook, Pinterest and Reddit
          publish once connected with one-click OAuth; handle-only connections queue until then.
        </p>
      </div>
    </form>
  );
}

/**
 * Named for what it does. "Go Live on all platforms" read as "start
 * broadcasting", which this has never done: it flips the on-air badge and
 * posts an announcement. Someone who took the old label at its word would
 * press it and wait for a stream that was never coming.
 */
function GoLiveButton({ liveNow }: { liveNow: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(goLive, {});
  if (liveNow) {
    return (
      <form action={endLive} className="flex items-center gap-3">
        <span className="flex items-center gap-2 rounded-full bg-brand2/15 px-3 py-1 text-xs font-bold uppercase text-brand2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand2" /> Live now
        </span>
        <button className="btn-ghost !py-2 text-sm">Mark me off air</button>
      </form>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <button className="btn-primary !py-2 text-sm" disabled={pending}>
        {pending ? "Announcing…" : "Announce I'm live"}
      </button>
      {state.error && <p className="text-xs text-brand2">{state.error}</p>}
    </form>
  );
}

/**
 * Where the creator streams, and the button that tells people about it.
 *
 * There used to be a stream-key field per platform and an RTMP address to
 * point OBS at. Neither did anything: the keys were stored and never read
 * again, and no media server exists to receive a stream. A field that
 * quietly discards whatever you paste into it is worse than no field, so
 * both are gone until the relay is real. Keys already saved stay in the
 * database, untouched, ready for when it is.
 */
function LiveStreamsForm({
  twitchChannel,
  facebookLiveUrl,
  instagramLiveUser,
  liveNow,
}: {
  twitchChannel: string;
  facebookLiveUrl: string;
  instagramLiveUser: string;
  liveNow: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveLiveStreams, {});
  const rows: Array<{ platform: PlatformDef; name: string; value: string; placeholder: string }> = [
    { platform: getPlatform("twitch")!, name: "twitchChannel", value: twitchChannel, placeholder: "yourchannel or twitch.tv/yourchannel" },
    { platform: getPlatform("facebook")!, name: "facebookLiveUrl", value: facebookLiveUrl, placeholder: "https://www.facebook.com/you/videos/..." },
    { platform: getPlatform("instagram")!, name: "instagramLiveUser", value: instagramLiveUser, placeholder: "yourhandle (for Instagram Live)" },
  ];
  return (
    <div className="mt-5 border-t border-edge pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Tell people you&apos;re live</h3>
          <p className="mt-1 text-xs text-mist">
            Link where you stream and your page shows the player. Add the{" "}
            <span className="text-snow">Live Streams</span> section in the Page Builder to put it there.
          </p>
        </div>
        <GoLiveButton liveNow={liveNow} />
      </div>
      <form action={formAction} className="mt-4">
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center gap-2">
              <PlatformIcon platform={r.platform} size={16} />
              <input name={r.name} defaultValue={r.value} className="field flex-1 !py-2 text-sm" placeholder={r.placeholder} />
            </div>
          ))}
        </div>
        {state.error && (
          <p className="mt-3 rounded-xl border border-brand2/40 bg-brand2/10 px-3 py-2 text-sm text-brand2">{state.error}</p>
        )}
        {state.ok && <p className="mt-3 text-sm font-semibold text-good">Live stream setup saved.</p>}
        <button className="btn-primary mt-3 !py-2 text-sm" disabled={pending}>
          {pending ? "Saving..." : "Save live setup"}
        </button>
      </form>

      {/* The most useful thing this panel can say, and the thing it used to
          bury underneath a stream-key field that went nowhere. */}
      <p className="mt-4 rounded-xl border border-edge bg-panel2 p-3 text-xs text-mist">
        <span className="font-semibold text-snow">Start the stream on the platform itself.</span> Ensemble does not
        broadcast for you. Go live on Twitch, Facebook or Instagram the way you normally do, then press Go Live here:
        your page shows an on-air badge, and every connected account gets a post saying where to watch.
      </p>
      <p className="mt-2 text-xs text-mist/70">
        Streaming once and appearing on all three at the same time needs a media server we have not switched on yet.
        When it is ready, this is where each platform&apos;s stream key will go.
      </p>
    </div>
  );
}


export function SocialIntegrations({
  accounts,
  twitchChannel,
  facebookLiveUrl,
  instagramLiveUser,
  liveNow,
  oauthReady,
  showLive,
}: {
  accounts: SocialAccount[];
  twitchChannel: string;
  facebookLiveUrl: string;
  instagramLiveUser: string;
  liveNow: boolean;
  oauthReady: string[];
  /** Live-stream tools are Enterprise — hidden (page shows a locked card) on lower plans. */
  showLive: boolean;
}) {
  return (
    <div className="card">
      <h2 className="font-bold">Social media</h2>
      <p className="mt-1 text-sm text-mist">
        Connect your platforms{showLive ? " and link your lives" : ""} — then post to all of them at once from{" "}
        <Link href="/dashboard/socials" className="text-brand hover:underline">Socials</Link>.
      </p>
      <div className="mt-4">
        <ConnectGrid accounts={accounts} oauthReady={oauthReady} />
      </div>
      {showLive && (
        <LiveStreamsForm
          twitchChannel={twitchChannel}
          facebookLiveUrl={facebookLiveUrl}
          instagramLiveUser={instagramLiveUser}
          liveNow={liveNow}
        />
      )}
    </div>
  );
}

/**
 * The Socials tab: the cross-post composer plus an activity feed. Every
 * platform icon appears in the feed header — lit in its brand color when
 * connected, greyed out when not — with the posting activity below.
 */
export function SocialsPanel({ accounts, posts }: { accounts: SocialAccount[]; posts: SocialPost[] }) {
  return (
    <>
      <div className="card">
        <h2 className="font-bold">Post everywhere at once</h2>
        <p className="mt-1 text-sm text-mist">One post, every connected account.</p>
        <Composer accounts={accounts} />
      </div>
      <ActivityFeed accounts={accounts} posts={posts} />
    </>
  );
}

function ActivityFeed({ accounts, posts }: { accounts: SocialAccount[]; posts: SocialPost[] }) {
  const byPlatform = new Map(accounts.map((a) => [a.platform, a]));
  return (
    <div className="card">
      <h2 className="font-bold">Activity Feed</h2>
      <p className="mt-1 text-sm text-mist">Lit icons are connected — their activity shows below.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {PLATFORMS.map((p) => {
          const account = byPlatform.get(p.id);
          const tile = (
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                account ? "border-good/40 bg-good/5" : "border-edge bg-panel2 opacity-35"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                width={20}
                height={20}
                aria-hidden
                style={account ? { filter: `drop-shadow(0 0 5px ${p.color})` } : undefined}
              >
                <path d={p.iconPath} fill={account ? iconFill(p.color) : "#71717a"} />
              </svg>
            </span>
          );
          return account ? (
            <a
              key={p.id}
              href={p.profileUrl(account.handle)}
              target="_blank"
              rel="noreferrer noopener"
              title={`${p.name} — @${account.handle.replace(/^@/, "")}`}
              className="transition hover:scale-105"
            >
              {tile}
            </a>
          ) : (
            <span key={p.id} title={`${p.name} — not connected`}>
              {tile}
            </span>
          );
        })}
      </div>
      {accounts.length === 0 ? (
        <p className="mt-5 border-t border-edge pt-5 text-sm text-mist">
          Nothing lit up yet —{" "}
          <Link href="/dashboard/integrations" className="text-brand hover:underline">connect your accounts in Integrations</Link>{" "}
          and their activity will land here.
        </p>
      ) : posts.length === 0 ? (
        <p className="mt-5 border-t border-edge pt-5 text-sm text-mist">
          No activity yet — your first cross-post will show up here with its delivery status per platform.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-edge border-t border-edge">
          {posts.map((post) => (
            <li key={post.id} className="py-2.5">
              <p className="whitespace-pre-line text-sm">{post.body}</p>
              {post.mediaUrl && (
                <a href={post.mediaUrl} target="_blank" rel="noreferrer" className="mt-0.5 block truncate font-mono text-xs text-brand hover:underline">
                  {post.mediaUrl}
                </a>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {post.targets.map((t) => {
                  const p = getPlatform(t.platform);
                  if (!p) return null;
                  const chip = (
                    <span
                      key={t.platform}
                      title={t.detail}
                      className="flex items-center gap-1 rounded-full bg-panel2 px-2 py-0.5 text-[11px] font-medium"
                    >
                      <PlatformIcon platform={p} size={11} /> {p.name}
                      <span className={t.status === "posted" ? "text-good" : t.status === "failed" ? "text-brand2" : "text-warn"}>
                        · {t.status}
                      </span>
                    </span>
                  );
                  return t.status === "posted" && t.detail.startsWith("http") ? (
                    <a key={t.platform} href={t.detail} target="_blank" rel="noreferrer" className="hover:opacity-80">
                      {chip}
                    </a>
                  ) : (
                    chip
                  );
                })}
                <span className="text-[11px] text-mist">{post.createdAt.slice(0, 16).replace("T", " ")}</span>
                {post.targets.some((t) => t.status !== "posted") && (
                  <form action={retrySocialPost}>
                    <input type="hidden" name="postId" value={post.id} />
                    <button className="text-[11px] font-semibold text-brand hover:underline">Retry</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
