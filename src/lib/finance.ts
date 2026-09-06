import "server-only";
import Stripe from "stripe";

/**
 * Creator-facing finance data, pulled with the CREATOR'S OWN Stripe key
 * (ideally a restricted, read-only key) — completely separate from the
 * platform's billing account in lib/billing.ts.
 */

/** One currency's balance. Stripe holds a separate balance per currency. */
export interface CurrencyBalance {
  currency: string;
  available: number;
  pending: number;
}

export interface FinanceSummary {
  /** The primary currency — the one the 30-day figures are reported in. */
  currency: string;
  /** Stripe balance in cents, for `currency`. */
  available: number;
  pending: number;
  /**
   * Every currency this account holds a balance in.
   *
   * balance.available has ONE ENTRY PER CURRENCY, and this used to sum
   * .amount across all of them and label the total with available[0].currency
   * — so a creator selling in USD and EUR saw €100 added to $100 and
   * presented as $200, with no conversion and no warning, on the tab that
   * calls it "the money they bring in".
   */
  balances: CurrencyBalance[];
  /** Last-30-days totals in cents, for `currency` only. */
  gross30: number;
  refunded30: number;
  count30: number;
  byDay: Array<{ day: string; amount: number }>;
  /** True when the charge scan hit its page cap, so the 30-day totals are partial. */
  truncated: boolean;
}

const DAYS = 30;

/** Throws with a readable message when the key is invalid or lacks access. */
export async function fetchStripeFinance(key: string): Promise<FinanceSummary> {
  const stripe = new Stripe(key);
  const since = Math.floor(Date.now() / 1000) - DAYS * 24 * 60 * 60;

  const balance = await stripe.balance.retrieve();
  // Grouped by currency rather than summed across them. The largest available
  // balance is treated as the primary one, which is what the headline figures
  // and the 30-day chart report in.
  const pendingFor = new Map(balance.pending.map((b) => [b.currency, b.amount]));
  const balances: CurrencyBalance[] = balance.available
    .map((b) => ({ currency: b.currency, available: b.amount, pending: pendingFor.get(b.currency) ?? 0 }))
    .sort((a, b) => b.available - a.available);

  const primary = balances[0] ?? { currency: "usd", available: 0, pending: 0 };
  const currency = primary.currency;
  const available = primary.available;
  const pending = primary.pending;

  let gross30 = 0;
  let refunded30 = 0;
  let count30 = 0;
  const byDayMap = new Map<string, number>();
  let startingAfter: string | undefined;
  let truncated = false;
  // Cap pagination so a huge account can't stall the dashboard. Hitting the
  // cap is REPORTED rather than swallowed — silently stopping at 500 charges
  // under-reports a busy account with no sign anything was left out.
  for (let page = 0; page < 5; page++) {
    const charges: Stripe.ApiList<Stripe.Charge> = await stripe.charges.list({
      limit: 100,
      created: { gte: since },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const c of charges.data) {
      if (c.status !== "succeeded") continue;
      // Only the primary currency, for the same reason the balances are split:
      // adding two currencies together produces a number that means nothing.
      if (c.currency !== currency) continue;
      gross30 += c.amount;
      refunded30 += c.amount_refunded;
      count30 += 1;
      const day = new Date(c.created * 1000).toISOString().slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + c.amount);
    }
    if (!charges.has_more) break;
    if (page === 4) truncated = true;
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

  return { currency, available, pending, balances, gross30, refunded30, count30, byDay, truncated };
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
    balances: [{ currency: "usd", available: 48250, pending: 12600 }],
    gross30,
    refunded30: 2800,
    count30: 63,
    byDay,
    truncated: false,
  };
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}
