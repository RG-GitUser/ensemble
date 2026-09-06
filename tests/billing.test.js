const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const LIB = process.env.TEST_LIB;
const billing = require(path.join(LIB, "billing.js"));
const store = require(path.join(LIB, "db.js"));

/**
 * The billing state machine and the entitlement layer.
 *
 * These are the two places a regression is silent and expensive: entitlement
 * decides what a customer may use, and the webhook handler decides what we
 * believe they have paid for. Everything here is a behaviour the audit found
 * broken, so a failure means it has come back.
 */

/** A Site-shaped object; only the fields these functions read need to be real. */
function site(fields = {}) {
  return {
    id: 1,
    userId: 1,
    slug: "test",
    plan: "enterprise",
    published: true,
    config: {},
    embedToken: "",
    ingestKey: "",
    stripeCustomerId: "",
    stripeSubscriptionId: "",
    billingStatus: "active",
    billingEventAt: 0,
    createdAt: "",
    ...fields,
  };
}

/** Run `fn` with specific billing env, then put the environment back. */
function withEnv(env, fn) {
  const keys = ["STRIPE_SECRET_KEY", "ENSEMBLE_BILLING_DISABLED", "NODE_ENV"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
    return fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const LIVE = { STRIPE_SECRET_KEY: "sk_test_x", NODE_ENV: "production" };

/* ---------------- BILL-1: entitlement follows payment ---------------- */

test("a cancelled subscription drops the site to basic", () => {
  withEnv(LIVE, () => {
    const s = site({ plan: "enterprise", billingStatus: "canceled" });
    assert.equal(billing.effectivePlan(s), "basic");
    assert.equal(billing.planFor(s).live, false, "the live relay must not survive cancellation");
    assert.equal(billing.planFor(s).newsletter, false, "newsletters must not survive cancellation");
    assert.equal(billing.planFor(s).customDomain, false);
  });
});

test("an unpaid subscription drops the site to basic", () => {
  withEnv(LIVE, () => {
    assert.equal(billing.effectivePlan(site({ plan: "pro", billingStatus: "unpaid" })), "basic");
  });
});

test("past_due keeps the paid plan — a failed card is not a cancellation", () => {
  withEnv(LIVE, () => {
    assert.equal(billing.effectivePlan(site({ plan: "enterprise", billingStatus: "past_due" })), "enterprise");
  });
});

test("an active subscription keeps its plan", () => {
  withEnv(LIVE, () => {
    assert.equal(billing.effectivePlan(site({ plan: "pro", billingStatus: "active" })), "pro");
  });
});

/* ---------------- BILL-3: the free path must be asked for ---------------- */

test("production with no Stripe key and no opt-out fails CLOSED", () => {
  withEnv({ NODE_ENV: "production" }, () => {
    assert.equal(billing.billingPreviewMode(), false);
    assert.equal(billing.billingOk(site({ billingStatus: "" })), false);
    assert.equal(billing.effectivePlan(site({ plan: "enterprise", billingStatus: "" })), "basic");
  });
});

test("production with an explicit opt-out runs free on purpose", () => {
  withEnv({ NODE_ENV: "production", ENSEMBLE_BILLING_DISABLED: "1" }, () => {
    assert.equal(billing.billingPreviewMode(), true);
    assert.equal(billing.effectivePlan(site({ plan: "enterprise", billingStatus: "" })), "enterprise");
  });
});

test("outside production a missing key still means preview mode", () => {
  withEnv({ NODE_ENV: "development" }, () => {
    assert.equal(billing.billingPreviewMode(), true);
    assert.equal(billing.billingOk(site({ billingStatus: "" })), true);
  });
});

test("a live Stripe key is never preview mode", () => {
  withEnv(LIVE, () => assert.equal(billing.billingPreviewMode(), false));
});

/* ---------------- BILL-5: the webhook ordering guard ---------------- */

function freshSite() {
  const user = store.createUser(`u${Date.now()}${Math.floor(process.hrtime()[1])}@t.t`, "x", "T", "T");
  return store.createSite(user.id, `s-${user.id}`, "basic", {});
}

test("setSiteBilling refuses an event older than the watermark", () => {
  const s = freshSite();
  assert.equal(store.setSiteBilling(s.id, { billingStatus: "active", billingEventAt: 2000 }), true);
  assert.equal(
    store.setSiteBilling(s.id, { billingStatus: "canceled", billingEventAt: 1000 }),
    false,
    "a stale event must be refused"
  );
  const after = store.getSiteById(s.id);
  assert.equal(after.billingStatus, "active", "a stale event must not change status");
  assert.equal(after.billingEventAt, 2000, "a stale event must not rewind the watermark");
});

test("setSiteBilling applies an event at or after the watermark", () => {
  const s = freshSite();
  store.setSiteBilling(s.id, { billingStatus: "active", billingEventAt: 2000 });
  assert.equal(store.setSiteBilling(s.id, { billingStatus: "past_due", billingEventAt: 2000 }), true);
  assert.equal(store.setSiteBilling(s.id, { billingStatus: "canceled", billingEventAt: 3000 }), true);
  const after = store.getSiteById(s.id);
  assert.equal(after.billingStatus, "canceled");
  assert.equal(after.billingEventAt, 3000);
});

test("setSiteBilling writes without a watermark are not gated", () => {
  const s = freshSite();
  store.setSiteBilling(s.id, { billingStatus: "active", billingEventAt: 5000 });
  // ensureStripeCustomer stores the customer id with no event time.
  assert.equal(store.setSiteBilling(s.id, { stripeCustomerId: "cus_x" }), true);
  const after = store.getSiteById(s.id);
  assert.equal(after.stripeCustomerId, "cus_x");
  assert.equal(after.billingEventAt, 5000, "an ungated write must not disturb the watermark");
});

test("setSiteBilling touches only the columns it was given", () => {
  const s = freshSite();
  store.setSiteBilling(s.id, {
    stripeCustomerId: "cus_a",
    stripeSubscriptionId: "sub_a",
    billingStatus: "active",
    billingEventAt: 10,
  });
  store.setSiteBilling(s.id, { billingStatus: "past_due", billingEventAt: 20 });
  const after = store.getSiteById(s.id);
  assert.equal(after.stripeCustomerId, "cus_a");
  assert.equal(after.stripeSubscriptionId, "sub_a");
});

/* ---------------- BILL-4: upgrade and downgrade are not symmetrical ---------------- */

test("plan order is what upgrade/downgrade is decided from", () => {
  const { PLAN_ORDER } = require(path.join(LIB, "plans.js"));
  assert.ok(PLAN_ORDER.indexOf("enterprise") > PLAN_ORDER.indexOf("pro"));
  assert.ok(PLAN_ORDER.indexOf("pro") > PLAN_ORDER.indexOf("basic"));
});

/* ---------------- plan definitions ---------------- */

test("an unknown plan id falls back to basic, never to a paid tier", () => {
  const { getPlan } = require(path.join(LIB, "plans.js"));
  assert.equal(getPlan("enterprise ").id, "basic");
  assert.equal(getPlan("").id, "basic");
  assert.equal(getPlan(null).id, "basic");
  assert.equal(getPlan(undefined).id, "basic");
  assert.equal(getPlan("__proto__").id, "basic");
});

test("the sidebar's plan flags match the tiers they are badged as", () => {
  const { PLANS } = require(path.join(LIB, "plans.js"));
  // helpdesk and social are true on every tier — badging their pages as
  // upgrade-only put a paywall on pages every customer can already open.
  assert.equal(PLANS.basic.helpdesk, true);
  assert.equal(PLANS.basic.social, true);
  // These genuinely are Enterprise.
  assert.equal(PLANS.basic.newsletter, false);
  assert.equal(PLANS.pro.newsletter, false);
  assert.equal(PLANS.enterprise.newsletter, true);
  assert.equal(PLANS.enterprise.live, true);
  assert.equal(PLANS.pro.live, false);
});
