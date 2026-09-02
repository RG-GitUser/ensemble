import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { billingEnabled, billingOk } from "@/lib/billing";
import { getDomainBySite, getSiteByUser, getUserPrefs } from "@/lib/db";
import { domainProgress } from "@/lib/domains";
import { getPlan, PLAN_ORDER, PLANS } from "@/lib/plans";
import { changePlan, openBillingPortal, toggleTutorials } from "@/lib/actions";
import { DangerButton } from "@/components/DangerButton";
import { SettingsForm } from "@/components/SettingsForm";
import { BackupEmailCard } from "@/components/BackupEmailCard";
import { mailEnabled } from "@/lib/mailer";
import Link from "next/link";

const BILLING_LABELS: Record<string, { label: string; tone: string }> = {
  active: { label: "Active", tone: "bg-good/15 text-good" },
  past_due: { label: "Past due — update your payment method", tone: "bg-warn/15 text-warn" },
  unpaid: { label: "Awaiting first payment", tone: "bg-warn/15 text-warn" },
  canceled: { label: "Canceled", tone: "bg-brand2/15 text-brand2" },
};

/** Is `to` a step up from `from`? Decides whether we warn or reassure. */
function upgrade(from: string, to: string): boolean {
  return PLAN_ORDER.indexOf(to as (typeof PLAN_ORDER)[number]) > PLAN_ORDER.indexOf(from as (typeof PLAN_ORDER)[number]);
}

export default async function SettingsPage() {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");
  const domain = getDomainBySite(site.id);
  const prefs = getUserPrefs(user.id);
  const domainState = domainProgress({
    hostname: domain?.hostname ?? "",
    verified: !!domain?.verifiedAt,
    dnsSeen: !!domain?.lastSeen,
    published: site.published,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-mist">Your page URL, domain, branding and plan.</p>

      <div className="mt-6 space-y-6">
        <SettingsForm slug={site.slug} />

        <BackupEmailCard
          backupEmail={user.backupEmail}
          verified={user.backupVerifiedAt > 0}
          mailOn={mailEnabled()}
        />

        {/* The full step-by-step lives on My Website so there's exactly one
            place to set a domain up — this is just the status + a way in. */}
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-bold">Your own domain</h2>
              <p className="mt-1 text-sm text-mist">
                {!getPlan(site.plan).customDomain ? (
                  "Available on Pro and Enterprise — serve your page on a domain you own."
                ) : domain ? (
                  <>
                    <span className="font-mono text-snow">{domain.hostname}</span>
                    {domainState.live
                      ? " — live"
                      : domain.lastSeen
                        ? " — connected, publish your page to go live"
                        : " — waiting on DNS"}
                  </>
                ) : (
                  `Not set up yet. ${domainState.total} short steps, no jargon.`
                )}
              </p>
              {getPlan(site.plan).customDomain && !domainState.live && (
                <p className="mt-1 text-xs text-mist/70">
                  {domainState.done} of {domainState.total} steps done
                </p>
              )}
            </div>
            <Link href="/dashboard/connect#domain" className="btn-ghost !py-2 text-sm">
              {domain ? "Manage domain" : "Set up domain"}
            </Link>
          </div>
        </div>

        {/* Tutorials. Switching them on replays every tour from the start —
            that's what people mean when they turn tips back on. */}
        <div className="card" data-tour="tutorials">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-bold">Tutorials</h2>
              <p className="mt-1 text-sm text-mist">
                {prefs.tutorialsEnabled
                  ? "Tips appear the first time you open each part of the dashboard. Dismiss one at a time, or switch them off here."
                  : "Tutorial tips are off. Turn them back on to see them again from the beginning."}
              </p>
            </div>
            <form action={toggleTutorials}>
              <button className={prefs.tutorialsEnabled ? "btn-ghost !py-2 text-sm" : "btn-primary !py-2 text-sm"}>
                {prefs.tutorialsEnabled ? "Turn tutorials off" : "Tutorials on"}
              </button>
            </form>
          </div>
        </div>

        <div className="card" data-tour="plan">
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
                <div key={id} className={`rounded-xl border p-4 ${current ? "border-brand bg-brand/5" : "border-edge bg-panel2"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-lg font-extrabold">${p.price}<span className="text-xs font-normal text-mist">/mo</span></span>
                  </div>
                  <p className="mt-1 text-xs text-mist">{p.blurb}</p>
                  {current ? (
                    <p className="mt-3 w-full cursor-default rounded-lg bg-brand/20 px-3 py-2 text-center text-sm font-semibold text-brand">
                      Current plan
                    </p>
                  ) : (
                    /* Switching plans moves money and can unpublish sections, so
                       it asks first and says which way it is going. It was a
                       single unguarded click. */
                    <DangerButton
                      label="Switch"
                      title={upgrade(site.plan, id) ? `Upgrade to ${p.name}?` : `Move down to ${p.name}?`}
                      body={
                        upgrade(site.plan, id)
                          ? `You'll be charged $${p.price} a month. On an active subscription the change is prorated straight away; without one, you'll go through checkout.`
                          : `You'll drop to $${p.price} a month and lose everything ${PLANS[site.plan].name} adds. Your content stays, but sections above the ${p.name} limit unpublish until you upgrade again.`
                      }
                      confirmLabel={upgrade(site.plan, id) ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                      action={changePlan}
                      fields={{ plan: id }}
                      className="mt-3 w-full rounded-lg border border-edge px-3 py-2 text-sm font-semibold text-snow transition hover:border-brand/60"
                    />
                  )}
                </div>
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
