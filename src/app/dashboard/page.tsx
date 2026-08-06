import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { billingEnabled, billingOk, reconcileBilling } from "@/lib/billing";
import { countLeads, countSections, getQuoteByUser, getSiteByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { resumeCheckout, togglePublish } from "@/lib/actions";

const QUOTE_STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: "Received — we'll reach out soon", tone: "text-warn" },
  quoted: { label: "Quote sent — check your email", tone: "text-good" },
  closed: { label: "Closed", tone: "text-mist" },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string; billing?: string }>;
}) {
  const user = await requireUser();
  let site = getSiteByUser(user.id);
  const quote = getQuoteByUser(user.id);
  const { quote: quoteFlag, billing: billingFlag } = await searchParams;
  if (!site && !quote) redirect("/onboarding");

  // Stripe redirects here before its webhook usually lands — ask Stripe
  // directly so a paying user never sees a stale "unpaid" state.
  if (site && billingFlag === "success" && billingEnabled() && !billingOk(site)) {
    try {
      site = await reconcileBilling(site);
    } catch {
      // Stripe unreachable — the webhook will still arrive.
    }
  }

  const plan = site ? getPlan(site.plan) : null;
  const sectionsUsed = site ? countSections(site.id) : 0;
  const leads = site && plan?.newsletter ? countLeads(site.id) : 0;
  const needsBilling = !!site && billingEnabled() && !billingOk(site);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-mist">Hey {user.name.split(" ")[0]} — here&apos;s where {user.businessName} stands.</p>

      {quoteFlag === "submitted" && (
        <div className="card mt-6 border-good/40 bg-good/5">
          <p className="font-semibold text-good">Quote request received!</p>
          <p className="mt-1 text-sm text-mist">
            We&apos;ll look at your site and reach out at <span className="text-snow">{user.email}</span> with an actual
            quote for the integration.
          </p>
        </div>
      )}

      {billingFlag === "success" && !needsBilling && (
        <div className="card mt-6 border-good/40 bg-good/5">
          <p className="font-semibold text-good">Your subscription is active!</p>
          <p className="mt-1 text-sm text-mist">You&apos;re all set — publish whenever you&apos;re ready.</p>
        </div>
      )}
      {billingFlag === "error" && (
        <div className="card mt-6 border-brand2/40 bg-brand2/5">
          <p className="font-semibold text-brand2">Something went wrong talking to our payment provider.</p>
          <p className="mt-1 text-sm text-mist">Nothing was charged. Try again in a minute.</p>
        </div>
      )}
      {needsBilling && (
        <div className="card mt-6 border-warn/40 bg-warn/5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-warn">
                {site!.billingStatus === "canceled"
                  ? "Your subscription has ended"
                  : "Finish setting up your subscription"}
              </p>
              <p className="mt-1 text-sm text-mist">
                Your page can&apos;t go live until your {getPlan(site!.plan).name} plan (${getPlan(site!.plan).price}/mo)
                is active. If you just paid, this updates within a few seconds — refresh before retrying.
              </p>
            </div>
            <form action={resumeCheckout}>
              <button className="btn-primary !py-2 text-sm">Complete checkout</button>
            </form>
          </div>
        </div>
      )}

      {quote && (
        <div className="card mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Website integration</h2>
              <p className="mt-1 text-sm text-mist">{quote.websiteUrl}</p>
            </div>
            <span className={`text-sm font-semibold ${QUOTE_STATUS[quote.status]?.tone ?? "text-mist"}`}>
              {QUOTE_STATUS[quote.status]?.label ?? quote.status}
            </span>
          </div>
        </div>
      )}

      {site && plan ? (
        <>
          <div className="card mt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-bold">Your page</h2>
                <p className="mt-1 text-sm text-mist">
                  ensemble / <span className="font-mono text-snow">s/{site.slug}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    site.published ? "bg-good/15 text-good" : "bg-warn/15 text-warn"
                  }`}
                >
                  {site.published ? "● Live" : "● Draft"}
                </span>
                <form action={togglePublish}>
                  <button
                    disabled={!site.published && needsBilling}
                    title={!site.published && needsBilling ? "Complete checkout to publish" : undefined}
                    className={site.published ? "btn-ghost !py-2 text-sm" : "btn-primary !py-2 text-sm"}
                  >
                    {site.published ? "Unpublish" : "Publish"}
                  </button>
                </form>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/dashboard/builder" className="btn-primary !py-2 text-sm">Edit page</Link>
              <Link href={`/s/${site.slug}?preview=1`} className="btn-ghost !py-2 text-sm" target="_blank">
                Preview ↗
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="card !p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-mist">Plan</p>
              <p className="mt-1.5 text-xl font-bold">{plan.name}</p>
              <p className="text-sm text-mist">${plan.price}/month</p>
            </div>
            <div className="card !p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-mist">Sections</p>
              <p className="mt-1.5 text-xl font-bold">
                {sectionsUsed}
                <span className="text-sm font-normal text-mist">
                  {" "}/ {plan.maxSections === Infinity ? "∞" : plan.maxSections}
                </span>
              </p>
              <p className="text-sm text-mist">{plan.maxSections === Infinity ? "Unlimited" : "on your plan"}</p>
            </div>
            <div className="card !p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-mist">Subscribers</p>
              <p className="mt-1.5 text-xl font-bold">{plan.newsletter ? leads : "—"}</p>
              <p className="text-sm text-mist">{plan.newsletter ? "newsletter signups" : "Enterprise feature"}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="card mt-6">
          <h2 className="font-bold">Want a hosted page too?</h2>
          <p className="mt-1 text-sm text-mist">
            While your integration is being quoted, you can spin up a hosted landing page from scratch.
          </p>
          <Link href="/onboarding" className="btn-primary mt-4 !py-2 text-sm">Start from scratch</Link>
        </div>
      )}
    </div>
  );
}
