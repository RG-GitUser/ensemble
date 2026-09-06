import Link from "next/link";
import { TierBadge } from "@/components/TierBadge";

/**
 * Renders the feature UI dimmed and inert under a plan badge, so lower tiers
 * see exactly what an upgrade unlocks.
 *
 * Presentation only, and that is the point to keep hold of: this is 40%
 * opacity and a 1.5px blur, which is a visual effect, not a redaction — the
 * children are fully readable in the HTML. So callers must pass a PLACEHOLDER
 * for anything the plan hasn't paid for, never the real figures. Server-side
 * action gates remain the enforcement for writes; for READS, not computing the
 * data is the enforcement.
 */
export function LockedOverlay({
  plan,
  className = "",
  children,
}: {
  plan: "Pro" | "Enterprise";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none select-none opacity-40 blur-[1.5px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-ink/40">
        <TierBadge plan={plan === "Pro" ? "pro" : "enterprise"} size="md" />
        <Link href="/dashboard/settings" className="btn-primary !py-2 text-sm">
          Upgrade to unlock
        </Link>
      </div>
    </div>
  );
}
