import Link from "next/link";

/**
 * Renders the real feature UI dimmed and inert under a plan badge, so lower
 * tiers see exactly what an upgrade unlocks. Server-side action gates stay the
 * real enforcement — this only handles presentation.
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
        <span className="rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase text-warn">{plan}</span>
        <Link href="/dashboard/settings" className="btn-primary !py-2 text-sm">
          Upgrade to unlock
        </Link>
      </div>
    </div>
  );
}
