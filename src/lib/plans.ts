import type { Plan } from "./types";

export interface PlanDef {
  id: Plan;
  name: string;
  /** Monthly price in USD. */
  price: number;
  blurb: string;
  features: string[];
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
  highlight?: boolean;
}

// NOTE: Enterprise price is a placeholder — change it here and it updates everywhere.
export const PLANS: Record<Plan, PlanDef> = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 25,
    blurb: "Everything you need to get a page live today.",
    features: [
      "Landing page builder with copy & paste sections",
      "Basic database limits (up to 6 sections)",
      "Standard server",
      "Bonus content, creator bio & merch showcase",
      "No payment integrations",
    ],
    maxSections: 6,
    payments: false,
    calendar: false,
    chatroom: false,
    newsletter: false,
    helpdesk: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 35,
    blurb: "For creators with a growing, engaged audience.",
    features: [
      "Everything in Basic",
      "Large database for big engagement crowds (up to 20 sections)",
      "Fast, reliable server",
      "Stripe payment integrations — sell merch directly",
    ],
    maxSections: 20,
    payments: true,
    calendar: false,
    chatroom: false,
    newsletter: false,
    helpdesk: false,
    highlight: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: 75,
    blurb: "The full platform for serious creator businesses.",
    features: [
      "Everything in Pro",
      "Our best server tier",
      "Help desk support",
      "3rd-party calendar integrations",
      "Custom chatrooms for your followers",
      "Newsletters & memberships",
      "Unlimited sections",
    ],
    maxSections: Infinity,
    payments: true,
    calendar: true,
    chatroom: true,
    newsletter: true,
    helpdesk: true,
  },
};

export const PLAN_ORDER: Plan[] = ["basic", "pro", "enterprise"];

export function getPlan(id: string | null | undefined): PlanDef {
  if (id && id in PLANS) return PLANS[id as Plan];
  return PLANS.basic;
}
