import "server-only";
import Stripe from "stripe";

/**
 * Creator-facing finance data, pulled with the CREATOR'S OWN Stripe key
 * (ideally a restricted, read-only key) — completely separate from the
 * platform's billing account in lib/billing.ts.
 */

export interface FinanceSummary {
  currency: string;
  /** Stripe balance in cents. */
  available: number;
  pending: number;
  /** Last-30-days totals in cents. */
  gross30: number;
  refunded30: number;
  count30: number;
  byDay: Array<{ day: string; amount: number }>;
}

const DAYS = 30;

/** Throws with a readable message when the key is invalid or lacks access. */
export async function fetchStripeFinance(key: string): Promise<FinanceSummary> {
  const stripe = new Stripe(key);
  const since = Math.floor(Date.now() / 1000) - DAYS * 24 * 60 * 60;

  const balance = await stripe.balance.retrieve();
  const currency = balance.available[0]?.currency ?? "usd";
  const available = balance.available.reduce((s, b) => s + b.amount, 0);
  const pending = balance.pending.reduce((s, b) => s + b.amount, 0);

  let gross30 = 0;
  let refunded30 = 0;
  let count30 = 0;
  const byDayMap = new Map<string, number>();
  let startingAfter: string | undefined;
  // Cap pagination so a huge account can't stall the dashboard.
  for (let page = 0; page < 5; page++) {
    const charges: Stripe.ApiList<Stripe.Charge> = await stripe.charges.list({
      limit: 100,
      created: { gte: since },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const c of charges.data) {
      if (c.status !== "succeeded") continue;
      gross30 += c.amount;
      refunded30 += c.amount_refunded;
      count30 += 1;
      const day = new Date(c.created * 1000).toISOString().slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + c.amount);
    }
    if (!charges.has_more) break;
    startingAfter = charges.data[charges.data.length - 1]?.id;
  }

  const byDay: Array<{ day: string; amount: number }> = [];
  const now = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    byDay.push({ day: iso, amount: byDayMap.get(iso) ?? 0 });
  }

  return { currency, available, pending, gross30, refunded30, count30, byDay };
}

/** Sample numbers shown before a Stripe account is connected. */
export function sampleFinance(): FinanceSummary {
  const byDay: Array<{ day: string; amount: number }> = [];
  const now = new Date();
  // Deterministic pseudo-random so the sample chart looks alive but stable.
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const seed = (i * 2654435761) % 97;
    byDay.push({ day: d.toISOString().slice(0, 10), amount: 1500 + seed * 220 });
  }
  const gross30 = byDay.reduce((s, d) => s + d.amount, 0);
  return {
    currency: "usd",
    available: 48250,
    pending: 12600,
    gross30,
    refunded30: 2800,
    count30: 63,
    byDay,
  };
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
