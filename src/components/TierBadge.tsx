import { PLANS } from "@/lib/plans";
import type { Plan } from "@/lib/types";

/**
 * The one place tier badges get their colour. Each plan owns a hue so a badge
 * reads as "which tier" at a glance, on pricing cards and locked features alike.
 */
const TONE: Record<Plan, string> = {
  basic: "bg-mist/10 text-mist ring-mist/25",
  pro: "bg-brand/15 text-brand ring-brand/35",
  enterprise: "bg-brand2/15 text-brand2 ring-brand2/35",
};

const SIZE = {
  sm: "px-2.5 py-0.5 text-[10px]",
  md: "px-3 py-1 text-xs",
} as const;

export function TierBadge({
  plan,
  size = "sm",
  className = "",
}: {
  plan: Plan;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider ring-1 ${TONE[plan]} ${SIZE[size]} ${className}`}
    >
      {PLANS[plan].name}
    </span>
  );
}
