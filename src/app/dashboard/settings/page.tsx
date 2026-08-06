import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { billingEnabled, billingOk } from "@/lib/billing";
import { getSiteByUser } from "@/lib/db";
import { PLAN_ORDER, PLANS } from "@/lib/plans";
import { changePlan, openBillingPortal } from "@/lib/actions";
import { SettingsForm } from "@/components/SettingsForm";

const BILLING_LABELS: Record<string, { label: string; tone: string }> = {
  active: { label: "Active", tone: "bg-good/15 text-good" },
  past_due: { label: "Past due — update your payment method", tone: "bg-warn/15 text-warn" },
  unpaid: { label: "Awaiting first payment", tone: "bg-warn/15 text-warn" },
  canceled: { label: "Canceled", tone: "bg-brand2/15 text-brand2" },
};

export default async function SettingsPage() {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-mist">Your page URL, branding and plan.</p>

      <div className="mt-6 space-y-6">
        <SettingsForm slug={site.slug} tagline={site.config.tagline} themeColor={site.config.themeColor} />

        <div className="card">
          <h2 className="font-bold">Your plan</h2>
          <p className="mt-1 text-sm text-mist">
            Switch plans any time. Your page keeps its content — sections above a lower plan&apos;s limit just unpublish
            until you upgrade again.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {PLAN_ORDER.map((id) => {
              const p = PLANS[id];
              const current = site.plan === id;
              return (
                <form key={id} action={changePlan} className={`rounded-xl border p-4 ${current ? "border-brand bg-brand/5" : "border-edge bg-panel2"}`}>
                  <input type="hidden" name="plan" value={id} />
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-lg font-extrabold">${p.price}<span className="text-xs font-normal text-mist">/mo</span></span>
                  </div>
                  <p className="mt-1 text-xs text-mist">{p.blurb}</p>
                  <button
                    disabled={current}
                    className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      current
                        ? "cursor-default bg-brand/20 text-brand"
                        : "border border-edge text-snow hover:border-brand/60"
                    }`}
                  >
                    {current ? "Current plan" : "Switch"}
                  </button>
                </form>
              );
            })}
          </div>
          {billingEnabled() ? (
            <p className="mt-4 text-xs text-mist/70">
              Plan changes on an active subscription are prorated automatically. Without one, switching sends you
              through checkout.
            </p>
          ) : (
            <p className="mt-4 text-xs text-mist/70">
              Billing isn&apos;t connected in this environment — plan changes are instant and free while Ensemble is in
              preview.
            </p>
          )}
        </div>

        {billingEnabled() && (
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-bold">Billing</h2>
                <p className="mt-2 text-sm text-mist">
                  {PLANS[site.plan].name} plan · ${PLANS[site.plan].price}/month
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  (BILLING_LABELS[site.billingStatus] ?? BILLING_LABELS.unpaid).tone
                }`}
              >
                {(BILLING_LABELS[site.billingStatus] ?? BILLING_LABELS.unpaid).label}
              </span>
            </div>
            {site.stripeCustomerId ? (
              <form action={openBillingPortal} className="mt-4">
                <button className="btn-ghost !py-2 text-sm">Manage billing — invoices, card, cancel ↗</button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-mist">
                {billingOk(site)
                  ? "Billing details will appear here after your first checkout."
                  : "Complete checkout from the Overview page to start your subscription."}
              </p>
            )}
          </div>
        )}

        <div className="card">
          <h2 className="font-bold">Account</h2>
          <p className="mt-2 text-sm text-mist">
            Signed in as <span className="text-snow">{user.email}</span> · {user.name} · {user.businessName}
          </p>
        </div>
      </div>
    </div>
  );
}
