import type { Plan } from "./types";

export interface PlanDef {
  id: Plan;
  name: string;
  /** Monthly price in USD. */
  price: number;
  blurb: string;
  /** Max sections a site on this plan may have. Infinity = unlimited. */
  maxSections: number;
  /** Stripe payment integrations (buy buttons / payment links on merch). */
  payments: boolean;
  /** Third-party calendar embeds. */
  calendar: boolean;
  /** Custom chatrooms for followers. */
  chatroom: boolean;
  /** Newsletters / memberships (email capture). */
  newsletter: boolean;
  /** Help desk support. */
  helpdesk: boolean;
  /** Serve the page on a creator-owned domain. */
  customDomain: boolean;
  /** Hide the "Powered by Ensemble" footer on pages and embeds. */
  whiteLabel: boolean;
  /** Connect social accounts and cross-post from the dashboard. */
  social: boolean;
  /**
   * Live players on the page, plus the on-air badge and the one-press
   * announcement. Not simulcast: nothing here rebroadcasts a stream, and the
   * relay that would needs a media server this project does not deploy.
   */
  live: boolean;
  /** Daily view charts in Analytics. */
  dailyAnalytics: boolean;
  /** Referrer breakdown in Analytics. */
  referrerAnalytics: boolean;
  highlight?: boolean;
}

// NOTE: Enterprise price is a placeholder — change it here and it updates everywhere.
export const PLANS: Record<Plan, PlanDef> = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 25,
    blurb: "Everything you need to get a page live today.",
    maxSections: 6,
    payments: false,
    calendar: false,
    chatroom: false,
    newsletter: false,
    helpdesk: true,
    customDomain: false,
    whiteLabel: false,
    social: false,
    live: false,
    dailyAnalytics: false,
    referrerAnalytics: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 45,
    blurb: "For creators with a growing, engaged audience.",
    maxSections: 20,
    payments: true,
    calendar: false,
    chatroom: false,
    newsletter: false,
    helpdesk: true,
    customDomain: true,
    whiteLabel: true,
    social: true,
    live: false,
    dailyAnalytics: true,
    referrerAnalytics: false,
    highlight: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: 65,
    blurb: "For creators who go live — stream once and broadcast everywhere, with your community and newsletter along for the ride.",
    maxSections: Infinity,
    payments: true,
    calendar: true,
    chatroom: true,
    newsletter: true,
    helpdesk: true,
    customDomain: true,
    whiteLabel: true,
    social: true,
    live: true,
    dailyAnalytics: true,
    referrerAnalytics: true,
  },
};

export const PLAN_ORDER: Plan[] = ["basic", "pro", "enterprise"];

export function getPlan(id: string | null | undefined): PlanDef {
  if (id && id in PLANS) return PLANS[id as Plan];
  return PLANS.basic;
}

/**
 * The canonical feature list shown on pricing cards. A card lists only the
 * lines its plan includes, so `requires` here should mirror the capability
 * flags above.
 */
export interface TierFeature {
  label: string;
  /** Minimum plan that includes this, or null when every plan has it. */
  requires: Plan | null;
}

export const TIER_FEATURES: TierFeature[] = [
  { label: "Landing page builder", requires: null },
  { label: "Access to the support team", requires: null },
  { label: "Stripe payment integrations — directly sell your products", requires: "pro" },
  { label: "Cross-post to all your socials at once", requires: "pro" },
  { label: "Daily traffic charts", requires: "pro" },
  { label: "Your own domain — no Ensemble branding", requires: "pro" },
  { label: "Go live everywhere — stream once, we broadcast it to every platform", requires: "enterprise" },
  { label: "Newsletters — collect subscribers, send to your whole list, export any time", requires: "enterprise" },
  { label: "Community chatroom for you and your followers", requires: "enterprise" },
  { label: "3rd-party calendar integrations for booking", requires: "enterprise" },
  { label: "Full analytics page", requires: "enterprise" },
];

export function planIncludes(plan: Plan, f: TierFeature): boolean {
  return !f.requires || PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(f.requires);
}

export function sectionsLabel(p: PlanDef): string {
  return p.maxSections === Infinity ? "Unlimited sections" : `Up to ${p.maxSections} sections`;
}

/** Compact per-plan lines ("Everything in X" + what this tier adds) for small cards. */
export function planFeatureLines(plan: Plan): string[] {
  const idx = PLAN_ORDER.indexOf(plan);
  const lines = idx > 0 ? [`Everything in ${PLANS[PLAN_ORDER[idx - 1]].name}`] : [];
  lines.push(sectionsLabel(PLANS[plan]));
  const addedHere = (f: TierFeature) => (f.requires ?? "basic") === plan;
  lines.push(...TIER_FEATURES.filter(addedHere).map((f) => f.label));
  return lines;
}
