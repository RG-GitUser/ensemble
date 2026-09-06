import "server-only";
import Stripe from "stripe";
import * as store from "./db";
import { getPlan, PLANS, PLAN_ORDER, type PlanDef } from "./plans";
import type { Plan, Site, User } from "./types";

/**
 * Stripe subscription billing. Activates when STRIPE_SECRET_KEY is set;
 * without it the app runs in preview mode (plan changes are instant and free).
 *
 * Env:
 *   STRIPE_SECRET_KEY          sk_live_... / sk_test_...
 *   STRIPE_WEBHOOK_SECRET      whsec_... (from `stripe listen` or the dashboard)
 *   APP_URL                    public origin for redirect URLs (default http://localhost:3000)
 *   ENSEMBLE_BILLING_DISABLED  set to 1 to run without billing on purpose
 *   STRIPE_AUTOMATIC_TAX       set to 1 once Stripe Tax is configured
 */

export function billingEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let warnedMisconfigured = false;

/**
 * True when plan changes are instant and free.
 *
 * This used to be "STRIPE_SECRET_KEY is absent", which is the shipped default
 * — .env.example has both Stripe lines commented out — so any signed-up user
 * could POST changePlan and hand themselves Enterprise, unlocking the live
 * relay, custom domains, chatrooms and newsletters for free. It was intended
 * as a preview escape hatch, but keying it on a MISSING variable means a
 * forgotten line of config silently opens the whole paywall.
 *
 * Now it has to be asked for. Outside production a missing key is just a dev
 * machine and still means preview mode; in production it is a misconfiguration,
 * and the safe reading of "I cannot tell whether this was paid for" is "no".
 */
export function billingPreviewMode(): boolean {
  if (process.env.ENSEMBLE_BILLING_DISABLED === "1") return true;
  if (billingEnabled()) return false;
  if (process.env.NODE_ENV === "production") {
    if (!warnedMisconfigured) {
      warnedMisconfigured = true;
      console.error(
        "[billing] STRIPE_SECRET_KEY is not set in production and ENSEMBLE_BILLING_DISABLED is not 1. " +
          "Failing closed: paid features are unavailable. Set one of the two."
      );
    }
    return false;
  }
  return true;
}

/** True when the site is allowed to be live under the current billing state. */
export function billingOk(site: Site): boolean {
  if (billingPreviewMode()) return true;
  return site.billingStatus === "active" || site.billingStatus === "past_due";
}

/**
 * The plan a site may actually USE right now.
 *
 * Entitlement was previously read straight off `site.plan`, while payment
 * state lived in a separate column that only four call sites consulted — and
 * nothing ever lowered the plan, since subscription.deleted set the status and
 * unpublished the page but left plan at "enterprise". So a cancelled customer
 * kept every paid feature: their public page went dark while newsletters still
 * went out through the platform's Resend account and verified sending domain,
 * social cross-posting still ran, and the live relay still burned the
 * droplet's egress — the most expensive and most reputation-sensitive
 * resources here, used for free and without limit.
 *
 * Routing entitlement through here makes the correct thing also the obvious
 * thing: every new paid feature gets this behaviour by default rather than
 * inheriting the bug.
 */
export function effectivePlan(site: Site): Plan {
  return billingOk(site) ? site.plan : "basic";
}

/** The plan DEFINITION a site may actually use — the entitlement entry point. */
export function planFor(site: Site): PlanDef {
  return getPlan(effectivePlan(site));
}

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

let client: Stripe | null = null;
function stripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

/* ---------------- products & prices ---------------- */

function lookupKey(plan: Plan): string {
  return `ensemble_${plan}_monthly`;
}

/** priceId -> verified against PLANS this process. */
const priceCache = new Map<Plan, string>();

/**
 * Resolve the Stripe price for a plan by lookup key, creating it on first use.
 * If PLANS has changed since the price was created, a replacement price takes
 * over the lookup key so checkouts always charge the advertised amount.
 */
async function priceIdFor(plan: Plan): Promise<string> {
  const cached = priceCache.get(plan);
  if (cached) return cached;

  const def = PLANS[plan];
  const key = lookupKey(plan);
  const found = await stripe().prices.list({ lookup_keys: [key], active: true, limit: 1 });
  const existing = found.data[0];
  let id: string;

  if (existing && existing.unit_amount === def.price * 100) {
    id = existing.id;
  } else if (existing) {
    // Advertised price changed — mint a new price and move the lookup key.
    const replacement = await stripe().prices.create({
      product: typeof existing.product === "string" ? existing.product : existing.product.id,
      unit_amount: def.price * 100,
      currency: "usd",
      recurring: { interval: "month" },
      lookup_key: key,
      transfer_lookup_key: true,
    });
    id = replacement.id;
  } else {
    const product = await stripe().products.create({
      name: `Ensemble ${def.name}`,
      description: def.blurb,
    });
    const price = await stripe().prices.create({
      product: product.id,
      unit_amount: def.price * 100,
      currency: "usd",
      recurring: { interval: "month" },
      lookup_key: key,
    });
    id = price.id;
  }
  priceCache.set(plan, id);
  return id;
}

function planForPrice(price: Stripe.Price | null | undefined): Plan | null {
  const key = price?.lookup_key ?? "";
  const m = key.match(/^ensemble_(basic|pro|enterprise)_monthly$/);
  return m ? (m[1] as Plan) : null;
}

/* ---------------- customers, checkout & portal ---------------- */

/**
 * Every checkout for a site runs against ONE Stripe customer, created up front
 * and stored before the first session — so duplicate/abandoned checkouts can
 * never mint parallel customers with invisible subscriptions.
 */
export async function ensureStripeCustomer(site: Site, user: User): Promise<string> {
  if (site.stripeCustomerId) return site.stripeCustomerId;
  const customer = await stripe().customers.create({
    email: user.email,
    name: user.businessName,
    metadata: { siteId: String(site.id) },
  });
  store.setSiteBilling(site.id, { stripeCustomerId: customer.id });
  return customer.id;
}

/** Start a subscription checkout for a site. Returns the URL to redirect to. */
export async function createCheckoutUrl(site: Site, user: User, plan: Plan): Promise<string> {
  const customerId = await ensureStripeCustomer(site, user);
  // Selling subscriptions across borders creates VAT and sales-tax obligations
  // from the first invoice. This is off unless asked for, because turning it on
  // before Stripe Tax is configured in the dashboard makes every checkout fail
  // — see DEPLOY.md. Enabling it is a launch step, not an optional polish one.
  const automaticTax = process.env.STRIPE_AUTOMATIC_TAX === "1";

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: await priceIdFor(plan), quantity: 1 }],
    customer: customerId,
    metadata: { siteId: String(site.id), plan },
    subscription_data: { metadata: { siteId: String(site.id) } },
    ...(automaticTax
      ? {
          automatic_tax: { enabled: true },
          // Stripe needs somewhere to derive the tax jurisdiction from, and
          // refuses automatic_tax on an existing customer without this.
          customer_update: { address: "auto" as const },
          tax_id_collection: { enabled: true },
        }
      : {}),
    success_url: `${appUrl()}/dashboard?billing=success`,
    cancel_url: `${appUrl()}/dashboard?billing=canceled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** Open the Stripe customer portal (payment method, invoices, cancel). */
export async function createPortalUrl(customerId: string): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl()}/dashboard/settings`,
  });
  return session.url;
}

/**
 * Switch an existing subscription to a different plan.
 *
 * Upgrades and downgrades are NOT symmetrical, and treating them as one thing
 * was a way to give away the difference. With no proration and no move of the
 * billing anchor, the higher plan took effect immediately and raised no
 * invoice — so subscribing on Basic, switching to Enterprise on day 2 and back
 * on day 29 produced a Basic invoice, every month, forever.
 *
 * An upgrade therefore invoices straight away, and `error_if_incomplete` means
 * a card that fails leaves the subscription on the plan it was already paying
 * for rather than on the one it just failed to buy.
 *
 * A downgrade keeps the old behaviour, which is the honest one and is what the
 * Settings dialog promises: the month already paid for runs its course and the
 * lower price starts with the next invoice.
 */
export async function changeSubscriptionPlan(subscriptionId: string, plan: Plan): Promise<void> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (!item) throw new Error(`Subscription ${subscriptionId} has no items`);

  const currentPlan = planForPrice(item.price);
  // Unknown current plan (a price we don't recognise) is treated as an upgrade:
  // billing immediately is the side that cannot give the product away.
  const isUpgrade = !currentPlan || PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(currentPlan);

  await stripe().subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price: await priceIdFor(plan) }],
    proration_behavior: isUpgrade ? "always_invoice" : "none",
    ...(isUpgrade ? { payment_behavior: "error_if_incomplete" as const } : {}),
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await stripe().subscriptions.cancel(subscriptionId);
}

/**
 * Ask Stripe directly for the site's current subscription state and apply it.
 * Called when a webhook may not have landed yet (post-checkout redirect) or as
 * a safety net; also cancels any duplicate subscriptions, keeping the newest.
 * Returns the refreshed site, or the input site when billing is off/unstarted.
 */
export async function reconcileBilling(site: Site): Promise<Site> {
  if (!billingEnabled() || !site.stripeCustomerId) return site;
  const subs = await stripe().subscriptions.list({
    customer: site.stripeCustomerId,
    status: "all",
    limit: 20,
  });
  const live = subs.data
    .filter((s) => !["canceled", "incomplete_expired"].includes(s.status))
    .sort((a, b) => b.created - a.created);

  const current = live[0];
  for (const dupe of live.slice(1)) {
    try {
      await cancelSubscription(dupe.id);
    } catch (err) {
      console.error(`Failed to cancel duplicate subscription ${dupe.id}:`, err);
    }
  }

  if (current) {
    store.setSiteBilling(site.id, {
      stripeSubscriptionId: current.id,
      billingStatus: mapSubscriptionStatus(current.status),
      // NOW, not the subscription's creation time. Stamping `current.created`
      // dropped the ordering guard back to whenever the subscription started,
      // so opening Settings on a ten-month-old subscription re-armed ten
      // months of stale events. This state was read live from the API a moment
      // ago, so "as of now" is exactly what it is.
      billingEventAt: Math.floor(Date.now() / 1000),
    });
    const plan = planForPrice(current.items.data[0]?.price);
    if (plan) store.updateSite(site.id, { plan });
  } else if (site.billingStatus === "active" || site.billingStatus === "past_due") {
    // We think we're paid but Stripe has no live subscription.
    store.setSiteBilling(site.id, { billingStatus: "canceled" });
    store.updateSite(site.id, { published: false });
  }
  return store.getSiteById(site.id) ?? site;
}

/* ---------------- webhooks ---------------- */

export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return stripe().webhooks.constructEvent(payload, signature, secret);
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    default:
      // canceled, unpaid, incomplete, incomplete_expired, paused
      return "canceled";
  }
}

/** Side effect the webhook route must perform with the Stripe API. */
export interface WebhookAction {
  cancelSubscriptionId?: string;
}

/**
 * Apply a Stripe event to our database. Pure with respect to Stripe — never
 * calls the API — so it can be tested with constructed events. Returns any
 * API side effect for the caller to execute.
 */
export function handleStripeEvent(event: Stripe.Event): WebhookAction {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const siteId = Number(session.metadata?.siteId);
      const plan = session.metadata?.plan ?? "";
      const site = store.getSiteById(siteId);
      if (!site) return {};
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : "";
      // Delayed payment methods (ACH/SEPA) complete the session before the
      // money moves — async_payment_succeeded promotes to active later.
      const paid = session.payment_status === "paid";
      const supersededSub =
        site.stripeSubscriptionId && subscriptionId && site.stripeSubscriptionId !== subscriptionId
          ? site.stripeSubscriptionId
          : undefined;
      store.setSiteBilling(site.id, {
        stripeCustomerId: typeof session.customer === "string" ? session.customer : site.stripeCustomerId,
        stripeSubscriptionId: subscriptionId || site.stripeSubscriptionId,
        billingStatus: paid ? "active" : "unpaid",
        billingEventAt: event.created,
      });
      if (paid && plan in PLANS) store.updateSite(site.id, { plan });
      return supersededSub ? { cancelSubscriptionId: supersededSub } : {};
    }
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const site = store.getSiteById(Number(session.metadata?.siteId));
      if (!site) return {};
      const plan = session.metadata?.plan ?? "";
      store.setSiteBilling(site.id, { billingStatus: "active", billingEventAt: event.created });
      if (plan in PLANS) store.updateSite(site.id, { plan });
      return {};
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object;
      const site = store.getSiteById(Number(session.metadata?.siteId));
      if (!site) return {};
      store.setSiteBilling(site.id, { billingStatus: "canceled", billingEventAt: event.created });
      return {};
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const site = siteForSubscription(sub);
      if (!site) return {};
      // Events for a subscription the site no longer tracks (superseded or
      // Stripe redelivery) must not clobber the current one.
      if (site.stripeSubscriptionId && site.stripeSubscriptionId !== sub.id) return {};
      // Stripe doesn't guarantee delivery order — ignore stale snapshots.
      if (event.created < site.billingEventAt) return {};
      const status = mapSubscriptionStatus(sub.status);
      store.setSiteBilling(site.id, {
        stripeSubscriptionId: sub.id,
        billingStatus: status,
        billingEventAt: event.created,
      });
      const plan = planForPrice(sub.items.data[0]?.price);
      if (plan) store.updateSite(site.id, { plan });
      // A subscription in a terminal state (unpaid/paused arrive via
      // `updated`, not `deleted`) can't keep a page live.
      if (status === "canceled" && site.published) store.updateSite(site.id, { published: false });
      return {};
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const site = siteForSubscription(sub);
      if (!site) return {};
      if (site.stripeSubscriptionId && site.stripeSubscriptionId !== sub.id) return {};
      store.setSiteBilling(site.id, { billingStatus: "canceled", billingEventAt: event.created });
      // A page without a subscription can't stay live.
      store.updateSite(site.id, { published: false });
      return {};
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : "";
      if (!customerId) return {};
      const site = store.getSiteByStripeCustomer(customerId);
      if (site && site.billingStatus === "active" && event.created >= site.billingEventAt) {
        store.setSiteBilling(site.id, { billingStatus: "past_due", billingEventAt: event.created });
      }
      return {};
    }
  }
  return {};
}

function siteForSubscription(sub: Stripe.Subscription): Site | null {
  const bySubId = store.getSiteByStripeSubscription(sub.id);
  if (bySubId) return bySubId;
  // Metadata fallback only ATTACHES a subscription to a site that has none
  // recorded yet (checkout race) — the id guard in the handlers enforces that.
  const siteId = Number(sub.metadata?.siteId);
  return siteId ? store.getSiteById(siteId) : null;
}
