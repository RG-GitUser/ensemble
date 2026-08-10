"use client";

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

function ConnectForm({ platform, oauthReady }: { platform: PlatformDef; oauthReady: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(connectSocial, {});

  if (platform.authType === "oauth" && platform.id === "threads" && oauthReady) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <PlatformIcon platform={platform} />
        <a href="/api/oauth/threads" className="btn-primary !py-2 text-sm">
          Continue with Threads
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
          {platform.name === "Threads" ? "Meta" : platform.name} app credentials are added.
        </p>
      )}
      {(platform.authType === "bluesky" || platform.authType === "webhook") && (
        <p className="w-full text-xs text-good/80">Publishes for real — no platform approval needed.</p>
      )}
      {state.error && <p className="w-full text-xs text-brand2">{state.error}</p>}
    </form>
  );
}

function ConnectGrid({ accounts, threadsOAuthReady }: { accounts: SocialAccount[]; threadsOAuthReady: boolean }) {
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
      {selected && !selAccount && <ConnectForm platform={selected} oauthReady={threadsOAuthReady} />}
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
    <form action={formAction} className="mt-5 border-t border-edge pt-5">
      <h3 className="text-sm font-bold">Post everywhere at once</h3>
      <textarea name="body" maxLength={2000} className="field mt-3 min-h-20 text-sm" placeholder="What's happening?" required />
      <input name="mediaUrl" className="field mt-2 font-mono text-xs" placeholder="Image or video link (optional) — https://…" />
      {/* No per-platform picker: posts go everywhere you're connected, and the
          connect grid above is already the source of truth for what that is. */}
      {accounts.length === 0 && (
        <p className="mt-3 text-xs text-warn">Connect a platform above to start posting.</p>
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
          Bluesky, Discord and OAuth-connected Threads publish for real; handle-only platforms queue until their API
          credentials exist.
        </p>
      </div>
    </form>
  );
}

function GoLiveButton({ liveNow }: { liveNow: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(goLive, {});
  if (liveNow) {
    return (
      <form action={endLive} className="flex items-center gap-3">
        <span className="flex items-center gap-2 rounded-full bg-brand2/15 px-3 py-1 text-xs font-bold uppercase text-brand2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand2" /> Live now
        </span>
        <button className="btn-ghost !py-2 text-sm">End stream</button>
      </form>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <button className="btn-primary !py-2 text-sm" disabled={pending}>
        {pending ? "Going live…" : "Go Live on all platforms"}
      </button>
      {state.error && <p className="text-xs text-brand2">{state.error}</p>}
    </form>
  );
}

function LiveStreamsForm({
  twitchChannel,
  facebookLiveUrl,
  instagramLiveUser,
  streamKeys,
  liveNow,
  ingestKey,
}: {
  twitchChannel: string;
  facebookLiveUrl: string;
  instagramLiveUser: string;
  streamKeys: { twitch: string; facebook: string; instagram: string };
  liveNow: boolean;
  ingestKey: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveLiveStreams, {});
  const rows: Array<{ platform: PlatformDef; name: string; value: string; placeholder: string; keyName: string; keyValue: string }> = [
    { platform: getPlatform("twitch")!, name: "twitchChannel", value: twitchChannel, placeholder: "yourchannel or twitch.tv/yourchannel", keyName: "twitchStreamKey", keyValue: streamKeys.twitch },
    { platform: getPlatform("facebook")!, name: "facebookLiveUrl", value: facebookLiveUrl, placeholder: "https://www.facebook.com/you/videos/…", keyName: "facebookStreamKey", keyValue: streamKeys.facebook },
    { platform: getPlatform("instagram")!, name: "instagramLiveUser", value: instagramLiveUser, placeholder: "yourhandle (for Instagram Live)", keyName: "instagramStreamKey", keyValue: streamKeys.instagram },
  ];
  return (
    <div className="mt-5 border-t border-edge pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Go live everywhere</h3>
          <p className="mt-1 text-xs text-mist">
            One button, all three platforms — and it announces the stream on every connected account. Add the{" "}
            <span className="text-snow">Live Streams</span> section in the Page Builder to show the players on your
            page.
          </p>
        </div>
        <GoLiveButton liveNow={liveNow} />
      </div>
      <form action={formAction} className="mt-4">
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.name} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="flex w-full items-center gap-2 sm:w-auto">
                <PlatformIcon platform={r.platform} size={16} />
                <input name={r.name} defaultValue={r.value} className="field flex-1 !py-2 text-sm" placeholder={r.placeholder} />
              </span>
              <input
                name={r.keyName}
                defaultValue={r.keyValue}
                type="password"
                autoComplete="off"
                className="field flex-1 !py-2 font-mono text-xs"
                placeholder={`${r.platform.name} stream key (optional, for simulcast)`}
              />
            </div>
          ))}
        </div>
        {state.error && (
          <p className="mt-3 rounded-xl border border-brand2/40 bg-brand2/10 px-3 py-2 text-sm text-brand2">{state.error}</p>
        )}
        {state.ok && <p className="mt-3 text-sm font-semibold text-good">Live stream setup saved.</p>}
        <button className="btn-primary mt-3 !py-2 text-sm" disabled={pending}>
          {pending ? "Saving…" : "Save live setup"}
        </button>
      </form>
      <p className="mt-3 rounded-xl bg-panel2 p-3 font-mono text-xs text-mist">
        Stream once from OBS to: rtmp://ingest.ensemble.app/live · key: {ingestKey}
      </p>
      <p className="mt-2 text-xs text-mist/70">
        Preview mode: the fan-out relay (your single stream → Twitch/Facebook/Instagram via the keys above) activates
        when Ensemble is deployed with its media server. Twitch &amp; Facebook players on your page are already real.
      </p>
    </div>
  );
}

export function SocialIntegrations({
  accounts,
  posts,
  twitchChannel,
  facebookLiveUrl,
  instagramLiveUser,
  streamKeys,
  liveNow,
  ingestKey,
  threadsOAuthReady,
  showLive,
}: {
  accounts: SocialAccount[];
  posts: SocialPost[];
  twitchChannel: string;
  facebookLiveUrl: string;
  instagramLiveUser: string;
  streamKeys: { twitch: string; facebook: string; instagram: string };
  liveNow: boolean;
  ingestKey: string;
  threadsOAuthReady: boolean;
  /** Live-stream tools are Enterprise — hidden (page shows a locked card) on lower plans. */
  showLive: boolean;
}) {
  return (
    <div className="card">
      <h2 className="font-bold">Social media</h2>
      <p className="mt-1 text-sm text-mist">
        Connect your platforms, post to all of them at once{showLive ? ", link your lives" : ""}.
      </p>
      <div className="mt-4">
        <ConnectGrid accounts={accounts} threadsOAuthReady={threadsOAuthReady} />
      </div>
      <Composer accounts={accounts} />
      {showLive && (
        <LiveStreamsForm
          twitchChannel={twitchChannel}
          facebookLiveUrl={facebookLiveUrl}
          instagramLiveUser={instagramLiveUser}
          streamKeys={streamKeys}
          liveNow={liveNow}
          ingestKey={ingestKey}
        />
      )}
      {posts.length > 0 && (
        <div className="mt-5 border-t border-edge pt-5">
          <h3 className="text-sm font-bold">Recent posts</h3>
          <ul className="mt-2 divide-y divide-edge">
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
        </div>
      )}
    </div>
  );
}
