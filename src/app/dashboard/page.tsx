import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { billingEnabled, billingOk, reconcileBilling } from "@/lib/billing";
import {
  countLeads,
  countSocialPosts,
  getDomainBySite,
  getQuoteByUser,
  getSections,
  getSiteByUser,
  getUserPrefs,
  getSocialAccounts,
  getLatestSocialStats,
  getSocialPosts,
  SITE_CONFIG_DEFAULTS,
} from "@/lib/db";
import { domainProgress } from "@/lib/domains";
import { getPlan } from "@/lib/plans";
import { DailyBreakdown } from "@/components/DailyBreakdown";
import { resumeCheckout, togglePublish } from "@/lib/actions";
import { SocialOverview } from "@/components/SocialOverview";
import { isStarterContent } from "@/lib/sections";
import { SetupChecklist, type Checkpoint } from "@/components/SetupChecklist";
import type { Section } from "@/lib/types";

/** Has the creator moved any part of the look off what the site ships with? */
function styled(cfg: NonNullable<ReturnType<typeof getSiteByUser>>["config"]): boolean {
  return (
    !!cfg.themeId ||
    !!cfg.fontId ||
    !!cfg.fontScale ||
    !!cfg.bgImage ||
    !!cfg.cardImage ||
    !!cfg.textColor ||
    !!cfg.layout ||
    !!cfg.containerSize ||
    !!cfg.borderStyle ||
    cfg.bgColor !== SITE_CONFIG_DEFAULTS.bgColor ||
    cfg.cardColor !== SITE_CONFIG_DEFAULTS.cardColor ||
    cfg.themeColor !== SITE_CONFIG_DEFAULTS.themeColor
  );
}

/**
 * The six checkpoints, in the order they're worth doing. Publishing is last on
 * purpose: it's the one that puts the page in front of people, so it reads as
 * the finish line rather than something to get out of the way.
 *
 * Always six, on every plan. A count that moves with the plan makes "4 of 6"
 * mean different amounts of work to different people, and a brand-new account
 * has to be able to read 0/6 — which is why the content checkpoints ask
 * whether a section has been *written*, not whether one exists. Signup seeds
 * four starter sections, so "has sections" is true before anyone has typed a
 * word.
 *
 * The domain used to be a seventh checkpoint on the plans that include it. It
 * has its own card directly below this one, with its own progress, so nothing
 * was lost by taking it out of the count.
 */
function setupSteps(
  site: NonNullable<ReturnType<typeof getSiteByUser>>,
  sections: Section[],
  businessName: string
): Checkpoint[] {
  const cfg = site.config;
  const footerTagline = sections.find((sec) => sec.type === "footer")?.content.tagline?.trim();
  const written = sections.filter((sec) => !isStarterContent(sec.type, sec.content, businessName));
  const heroWritten = written.some((sec) => sec.type === "hero");
  const othersWritten = written.filter((sec) => sec.type !== "hero").length;

  return [
    {
      id: "hero",
      label: "Write your headline",
      hint: "The hero is the first thing anyone reads. Put your name and what you make in it.",
      done: heroWritten,
      href: "/dashboard/builder",
      cta: "Edit my hero",
    },
    {
      id: "content",
      label: "Fill in your other sections",
      hint: "Two more sections in your own words and the page stops sounding like a template.",
      done: othersWritten >= 2,
      href: "/dashboard/builder",
      cta: "Edit my page",
    },
    {
      id: "design",
      label: "Pick your look",
      hint: "Choose a backdrop, a layout and a font. All of it is on every plan.",
      // Presence proves nothing: every one of these ships with a value, so
      // `bgColor !== undefined` was true for every site ever created and this
      // checkpoint could never read as outstanding. Only a value the creator
      // moved off the shipped default counts as a look they picked.
      done: styled(cfg),
      href: "/dashboard/builder?tab=design",
      cta: "Open Design",
    },
    {
      id: "icon",
      label: "Add your tab icon",
      hint: "The little icon in the browser tab. It's the difference between a page and a brand.",
      done: !!cfg.faviconUrl,
      href: "/dashboard/builder?tab=design",
      cta: "Upload an icon",
    },
    {
      id: "tagline",
      label: "Write your tagline",
      hint: "One line at the foot of your page. Add a Footer section and it's the first field.",
      // Two places it can come from. The Footer section is where it's written
      // now; site.config holds what Page settings used to save, which still
      // shows on pages with no Footer section of their own. Optional chain
      // despite the type, since config is JSON and an old row may lack the key.
      done: !!(footerTagline || cfg.tagline?.trim()),
      href: "/dashboard/builder",
      cta: "Open the builder",
    },
    {
      id: "publish",
      label: "Publish your page",
      hint: "When it's ready, publish. Your page goes live at your address.",
      done: site.published,
      href: "/dashboard",
      cta: "Publish",
    },
  ];
}

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
  const prefs = getUserPrefs(user.id);
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
  const domain = site ? getDomainBySite(site.id) : null;
  const sections = site ? getSections(site.id) : [];
  const sectionsUsed = sections.length;
  const leads = site && plan?.newsletter ? countLeads(site.id) : 0;
  const needsBilling = !!site && billingEnabled() && !billingOk(site);
  // Only read social rows for plans that can actually use the feature.
  const socialAccounts = site && plan?.social ? getSocialAccounts(site.id) : [];
  const socialPosts = site && plan?.social ? countSocialPosts(site.id) : 0;
  const domainState = domainProgress({
    hostname: domain?.hostname ?? "",
    verified: !!domain?.verifiedAt,
    dnsSeen: !!domain?.lastSeen,
    published: !!site?.published,
  });
  const lastSocialPost = site && plan?.social ? (getSocialPosts(site.id, 1)[0] ?? null) : null;
  const latestStats = site && plan?.social ? getLatestSocialStats(site.id) : [];

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
          {/* A finished checklist can be put away, and comes straight back
              if anything stops being done — unpublishing the page, say. So
              the flag only ever hides a card with nothing left to say. */}
          {(() => {
            const steps = setupSteps(site, sections, user.businessName);
            const complete = steps.every((s) => s.done);
            return complete && prefs.setupDismissed ? null : <SetupChecklist steps={steps} />;
          })()}

          <div className="card mt-6" data-tour="address">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-bold">Your page</h2>
                <p className="mt-1 text-sm text-mist">
                  {domain ? (
                    <span className="font-mono text-snow">{domain.hostname}</span>
                  ) : (
                    <>
                      ensemble / <span className="font-mono text-snow">{site.slug}</span>
                    </>
                  )}
                </p>
                {/* The way to a creator's own URL, from the page they land on
                    first — the full checklist stays on My Website, but until
                    now nothing on the dashboard said it existed. */}
                <p className="mt-1.5 text-xs text-mist/80">
                  {!plan.customDomain ? (
                    <>
                      Want your own URL?{" "}
                      <Link href="/dashboard/settings" className="text-brand hover:underline">
                        Pro and Enterprise
                      </Link>{" "}
                      serve this page on a domain you own.
                    </>
                  ) : domainState.live ? (
                    <>
                      Running on your own domain.{" "}
                      <Link href="/dashboard/connect#domain" className="text-brand hover:underline">
                        Manage it
                      </Link>
                    </>
                  ) : domain ? (
                    <>
                      Your domain is {domainState.done} of {domainState.total} steps from live.{" "}
                      <Link href="/dashboard/connect#domain" className="text-brand hover:underline">
                        Finish setup
                      </Link>
                    </>
                  ) : (
                    <>
                      Your plan includes your own URL.{" "}
                      <Link href="/dashboard/connect#domain" className="text-brand hover:underline">
                        Set it up in {domainState.total} short steps
                      </Link>
                    </>
                  )}
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
                <form action={togglePublish} data-tour="publish">
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
              <Link href={`/${site.slug}?preview=1`} className="btn-ghost !py-2 text-sm" target="_blank">
                Preview ↗
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

          {plan.social && <DailyBreakdown stats={latestStats} />}

          <SocialOverview
            accounts={socialAccounts}
            totalPosts={socialPosts}
            lastPost={lastSocialPost}
            canUse={plan.social}
          />
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
