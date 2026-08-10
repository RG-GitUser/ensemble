import Link from "next/link";
import { getPlatform, iconFill } from "@/lib/social";
import type { SocialAccount, SocialPost } from "@/lib/types";

/**
 * Social summary + shortcuts for the dashboard Overview. A Server Component:
 * everything here is a link, so it needs no client JS.
 */

/**
 * SQLite writes `datetime('now')` as UTC with a space separator, which
 * `Date.parse` would read as local time — every stamp silently off by the
 * machine's offset. Normalise to ISO with an explicit Z before parsing.
 */
function timeAgo(stamp: string): string {
  const iso = /[TZ]/.test(stamp) ? stamp : `${stamp.replace(" ", "T")}Z`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return stamp.slice(0, 16);
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return stamp.slice(0, 10);
}

function Icon({ platformId, size = 18 }: { platformId: string; size?: number }) {
  const p = getPlatform(platformId);
  if (!p) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d={p.iconPath} fill={iconFill(p.color)} />
    </svg>
  );
}

/** Matches the Plan / Sections / Subscribers tiles on the Overview exactly. */
function Stat({ label, value, unit, hint }: { label: string; value: React.ReactNode; unit?: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-mist">{label}</p>
      <p className="mt-1.5 text-xl font-bold">
        {value}
        {unit && <span className="text-sm font-normal text-mist"> {unit}</span>}
      </p>
      {hint && <p className="text-sm text-mist">{hint}</p>}
    </div>
  );
}

export function SocialOverview({
  accounts,
  totalPosts,
  lastPost,
  canUse,
}: {
  accounts: SocialAccount[];
  totalPosts: number;
  lastPost: SocialPost | null;
  canUse: boolean;
}) {
  if (!canUse) {
    return (
      <div className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold">Social</h2>
            <p className="mt-1 text-sm text-mist">
              Connect your accounts and cross-post everywhere at once — available on Pro.
            </p>
          </div>
          <Link href="/dashboard/settings" className="btn-ghost !py-2 text-sm">
            Upgrade
          </Link>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold">Social</h2>
            <p className="mt-1 text-sm text-mist">
              No accounts connected yet — link them to post everywhere from one place.
            </p>
          </div>
          <Link href="/dashboard/integrations" className="btn-primary !py-2 text-sm">
            Connect accounts
          </Link>
        </div>
      </div>
    );
  }

  const delivered = lastPost?.targets.filter((t) => t.status === "posted").length ?? 0;
  const failed = lastPost?.targets.filter((t) => t.status === "failed").length ?? 0;
  const queued = lastPost?.targets.filter((t) => t.status === "queued").length ?? 0;

  return (
    <div className="card mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">Social</h2>
        <Link href="/dashboard/integrations" className="text-sm text-brand hover:underline">
          Manage ↗
        </Link>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Connected"
          value={accounts.length}
          unit={accounts.length === 1 ? "account" : "accounts"}
        />
        <Stat label="Posts" value={totalPosts} unit="published" />
        <Stat
          label="Last post"
          value={lastPost ? timeAgo(lastPost.createdAt) : "—"}
          hint={
            lastPost
              ? [delivered && `${delivered} sent`, queued && `${queued} queued`, failed && `${failed} failed`]
                  .filter(Boolean)
                  .join(" · ")
              : "nothing posted yet"
          }
        />
      </div>

      {/* Quick actions: compose, plus a jump straight to each connected profile.
          Left-aligned rather than pushed apart — at narrow widths `ml-auto`
          wrapped the icons onto their own line and stranded them on the right. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href="/dashboard/integrations" className="btn-primary !py-2 text-sm">
          New post
        </Link>
        <span aria-hidden className="mx-1 hidden h-6 w-px bg-edge sm:block" />
        <span className="flex flex-wrap items-center gap-2">
          {accounts.map((a) => {
            const p = getPlatform(a.platform);
            if (!p) return null;
            return (
              <a
                key={a.platform}
                href={p.profileUrl(a.handle)}
                target="_blank"
                rel="noreferrer noopener"
                title={`${p.name} — @${a.handle}`}
                className="rounded-lg border border-edge p-1.5 transition hover:border-brand/60"
              >
                <Icon platformId={a.platform} size={16} />
              </a>
            );
          })}
        </span>
      </div>
    </div>
  );
}
