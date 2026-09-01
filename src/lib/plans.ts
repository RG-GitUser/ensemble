import type { Plan } from "./types";

export interface PlanDef {
  id: Plan;
  name: string;
  /** Monthly price in USD. */
  price: number;
  blurb: string;
  /**
   * Max sections a site on this plan may have. Unlimited on every tier now:
   * counting blocks is not what anyone is buying, and a cap punishes exactly
   * the behaviour we want. Tiers differ by which section TYPES they unlock,
   * which lives on each template's `requires` in sections.ts. Kept as a field
   * so a future abuse guard has somewhere to go.
   */
  maxSections: number;
  /** Stripe payment integrations (buy buttons / payment links on merch). */
  payments: boolean;
  /** Third-party calendar embeds. */
  calendar: boolean;
  /** Custom chatrooms for followers. */
  chatroom: boolean;
  /** Newsletters / memberships (collect subscribers, then write to them). */
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
   * Live players and the on-air badge on the page, the one-press
   * announcement, and the relay that pushes one incoming stream out to every
   * platform the creator saved a key for. See live.ts and deploy/mediamtx.yml.
   */
  live: boolean;
  /** Daily view charts in Analytics. */
  dailyAnalytics: boolean;
  /** Referrer breakdown in Analytics. */
  referrerAnalytics: boolean;
  highlight?: boolean;
}

/**
 * Each tier has one job a creator would recognise. Basic publishes, Pro sells
 * and reaches, Enterprise broadcasts and hosts a community. Nobody is limited
 * by how much page they build.
 */
export const PLANS: Record<Plan, PlanDef> = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 25,
    blurb: "Build the page your followers land on, as big as you like.",
    maxSections: Infinity,
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
    blurb: "Start selling, and reach every platform without doing it twice.",
    maxSections: Infinity,
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
    blurb:
      "For creators who go live. Stream once and broadcast everywhere, with your community and newsletter along for the ride.",
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
 * lines its plan includes, so `requires` here should mirror both the
 * capability flags above and the section templates each tier unlocks.
 */
export interface TierFeature {
  label: string;
  /** Minimum plan that includes this, or null when every plan has it. */
  requires: Plan | null;
}

export const TIER_FEATURES: TierFeature[] = [
  // Basic's lines name the section types every plan unlocks. Two generic
  // bullets made the entry tier look empty when it is not.
  { label: "Landing page builder, with as many sections as you want", requires: null },
  { label: "Bonus content hub for your followers", requires: null },
  { label: "Video, your story, and a link hub for every platform", requires: null },
  { label: "Contact section so people can reach you", requires: null },
  { label: "Access to the support team", requires: null },
  { label: "Merch store: sell with Stripe and keep every cent", requires: "pro" },
  { label: "Cross-post to all your socials at once", requires: "pro" },
  { label: "Your own domain, with no Ensemble branding", requires: "pro" },
  { label: "Daily traffic charts", requires: "pro" },
  // Enterprise leads with the relay. It is the one thing here nobody else
  // bundles at this price, and it is what the tier is actually sold on.
  { label: "Go live everywhere. Stream once, we broadcast it to every platform", requires: "enterprise" },
  { label: "Newsletters and memberships for your inner circle", requires: "enterprise" },
  { label: "Community chatroom for you and your followers", requires: "enterprise" },
  { label: "Event calendar for bookings and meet-and-greets", requires: "enterprise" },
  { label: "Full analytics, including where your traffic comes from", requires: "enterprise" },
];

export function planIncludes(plan: Plan, f: TierFeature): boolean {
  return !f.requires || PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(f.requires);
}

/** Every bullet for a plan's pricing card, in the order they should read. */
export function planBullets(plan: Plan): string[] {
  return TIER_FEATURES.filter((f) => planIncludes(plan, f)).map((f) => f.label);
}

/** Compact per-plan lines ("Everything in X" + what this tier adds) for small cards. */
export function planFeatureLines(plan: Plan): string[] {
  const idx = PLAN_ORDER.indexOf(plan);
  const lines = idx > 0 ? [`Everything in ${PLANS[PLAN_ORDER[idx - 1]].name}`] : [];
  const addedHere = (f: TierFeature) => (f.requires ?? "basic") === plan;
  lines.push(...TIER_FEATURES.filter(addedHere).map((f) => f.label));
  return lines;
}
