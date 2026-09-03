import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  countChatMessages,
  countLeads,
  countSections,
  getDailyViews,
  getFollowerCountsOn,
  getFollowerHistory,
  getSiteByUser,
  getSocialAccounts,
  getSocialStats,
  getTopReferrers,
  getTotalViews,
} from "@/lib/db";
import { fetchStripeFinance, formatMoney, sampleFinance, type FinanceSummary } from "@/lib/finance";
import { getPlan } from "@/lib/plans";
import { LockedOverlay } from "@/components/LockedOverlay";
import { SocialGrowth } from "@/components/SocialGrowth";
import { CardIcon, LedgerIcon } from "@/components/icons";
import { disconnectFinanceStripe } from "@/lib/actions";
import { FinanceConnectForm } from "@/components/FinanceConnectForm";
import { FollowerBreakdown } from "@/components/FollowerBreakdown";
import { cleanDay, todayISO } from "@/lib/followers";
import type { Site } from "@/lib/types";

const CHART_DAYS = 30;

function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function MoneyTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card !p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-mist">{label}</p>
      <p className="mt-1.5 text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-mist">{sub}</p>}
    </div>
  );
}

async function FinanceTab({ site }: { site: Site }) {
  const plan = getPlan(site.plan);
  if (!plan.payments) {
    return (
      <div className="card mt-6 border-dashed text-center">
        <span className="rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase text-warn">Pro feature</span>
        <p className="mt-3 font-bold">Financial breakdowns</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-mist">
          Connect Stripe and QuickBooks to see revenue, balances and payouts next to your traffic — on Pro and
          Enterprise.
        </p>
        <Link href="/dashboard/settings" className="btn-ghost mt-4 !py-2 text-sm">Upgrade in Settings</Link>
      </div>
    );
  }

  const key = site.config.financeStripeKey ?? "";
  let finance: FinanceSummary | null = null;
  let financeError = "";
  if (key) {
    try {
      finance = await fetchStripeFinance(key);
    } catch {
      financeError = "Stripe rejected the saved key — reconnect below.";
    }
  }
  const sample = !finance;
  const data = finance ?? sampleFinance();
  const maxAmount = Math.max(1, ...data.byDay.map((d) => d.amount));
  const quickbooksReady = !!process.env.INTUIT_CLIENT_ID && !!process.env.INTUIT_CLIENT_SECRET;

  return (
    <>
      <div className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <CardIcon className="text-mist" /> Stripe — your money
            </h2>
            <p className="mt-1 text-sm text-mist">
              {key && !financeError
                ? "Live data from your connected Stripe account."
                : "Connect your own Stripe account to see real balances and revenue."}
            </p>
          </div>
          {key && (
            <form action={disconnectFinanceStripe}>
              <button className="rounded-lg border border-edge px-3 py-1.5 text-xs text-mist transition hover:border-brand2/60 hover:text-brand2">
                Disconnect
              </button>
            </form>
          )}
        </div>
        {financeError && (
          <p className="mt-3 rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">
            {financeError}
          </p>
        )}
        {!key || financeError ? <FinanceConnectForm /> : null}
      </div>

      {sample && (
        <p className="mt-6 w-fit rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn">
          Sample data — connect Stripe above for your real numbers
        </p>
      )}

      <div className={`mt-4 grid gap-4 sm:grid-cols-4 ${sample ? "opacity-60" : ""}`}>
        <MoneyTile label="Available balance" value={formatMoney(data.available, data.currency)} />
        <MoneyTile label="Pending" value={formatMoney(data.pending, data.currency)} />
        <MoneyTile
          label="Revenue — 30 days"
          value={formatMoney(data.gross30, data.currency)}
          sub={`${data.count30} payments`}
        />
        <MoneyTile label="Refunded — 30 days" value={formatMoney(data.refunded30, data.currency)} />
      </div>

      <div className={`card mt-6 ${sample ? "opacity-60" : ""}`}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold">Daily revenue — last {CHART_DAYS} days</h2>
          <span className="text-xs text-mist">{formatMoney(data.gross30, data.currency)} total</span>
        </div>
        <div className="mt-5 flex h-36 items-end gap-[3px]">
          {data.byDay.map((d) => (
            <div
              key={d.day}
              title={`${dayLabel(d.day)}: ${formatMoney(d.amount, data.currency)}`}
              className="flex-1 rounded-t bg-gradient-to-t from-good/60 to-brand/60"
              style={{ height: `${Math.max(2, (d.amount / maxAmount) * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-mist">
          <span>{dayLabel(data.byDay[0].day)}</span>
          <span>{dayLabel(data.byDay[data.byDay.length - 1].day)}</span>
        </div>
      </div>

      <div className="card mt-6 border-dashed">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <LedgerIcon className="text-mist" /> QuickBooks
            </h2>
            <p className="mt-1 text-sm text-mist">
              Pull profit &amp; loss, expenses and invoices next to your Stripe revenue.
            </p>
          </div>
          <span className="rounded-full bg-warn/15 px-2.5 py-1 text-[10px] font-bold uppercase text-warn">
            {quickbooksReady ? "Ready" : "Coming online"}
          </span>
        </div>
        <p className="mt-3 text-sm text-mist">
          {quickbooksReady
            ? "One-click QuickBooks connect is configured — OAuth flow lands in the next update."
            : "One-click connect switches on when Ensemble's QuickBooks app credentials (INTUIT_CLIENT_ID / INTUIT_CLIENT_SECRET from developer.intuit.com) are configured."}
        </p>
      </div>
    </>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; on?: string; error?: string }>;
}) {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");
  const plan = getPlan(site.plan);
  const { tab, on, error } = await searchParams;
  const finance = tab === "finance";
  const followers = tab === "followers";

  const totalViews = getTotalViews(site.id);
  const sections = countSections(site.id);
  const subscribers = plan.newsletter ? countLeads(site.id) : null;
  const chatMessages = plan.chatroom ? countChatMessages(site.id) : null;

  // Fill the last CHART_DAYS days so the chart shows gaps, not just active days.
  // Only fetched when the plan allows it: LockedOverlay dims its children with
  // opacity and a 1.5px blur, which is a visual treatment, not a gate — the
  // real rows were being serialised into the HTML of every lower-tier account.
  const daily = plan.dailyAnalytics ? getDailyViews(site.id, CHART_DAYS) : [];
  const byDay = new Map(daily.map((d) => [d.day, d.views]));
  const days: Array<{ day: string; views: number }> = [];
  const now = new Date();
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ day: iso, views: byDay.get(iso) ?? 0 });
  }
  const maxViews = Math.max(1, ...days.map((d) => d.views));

  const referrers = plan.referrerAnalytics ? getTopReferrers(site.id) : [];

  // A date past today would ask the charts about a day that hasn't happened;
  // an unparseable one falls back the same way rather than throwing.
  const onDay = (followers && cleanDay(on ?? "") <= todayISO() ? cleanDay(on ?? "") : "") || todayISO();
  const followerHistory = followers ? getFollowerHistory(site.id) : [];

  const chartCard = (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold">Views — last {CHART_DAYS} days</h2>
        <span className="text-xs text-mist">{days.reduce((s, d) => s + d.views, 0)} total</span>
      </div>
      <div className="mt-5 flex h-36 items-end gap-[3px]">
        {days.map((d) => (
          <div
            key={d.day}
            title={`${dayLabel(d.day)}: ${d.views} view${d.views === 1 ? "" : "s"}`}
            className="flex-1 rounded-t bg-gradient-to-t from-brand/60 to-brand2/60"
            style={{ height: `${Math.max(2, (d.views / maxViews) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-mist">
        <span>{dayLabel(days[0].day)}</span>
        <span>{dayLabel(days[days.length - 1].day)}</span>
      </div>
    </div>
  );

  const referrerCard = (
    <div className="card">
      <h2 className="font-bold">Top referrers</h2>
      {referrers.length === 0 ? (
        <p className="mt-2 text-sm text-mist">No referrer data yet — share your page link around.</p>
      ) : (
        <ul className="mt-3 divide-y divide-edge text-sm">
          {referrers.map((r) => (
            <li key={r.referrer || "direct"} className="flex justify-between py-2">
              <span>{r.referrer || "Direct / unknown"}</span>
              <span className="text-mist">{r.views}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
      <p className="mt-1 text-sm text-mist">How your page — and your money — is doing.</p>

      <div className="mt-5 flex gap-2 border-b border-edge">
        {[
          { href: "/dashboard/analytics", label: "Traffic", active: !finance && !followers },
          { href: "/dashboard/analytics?tab=followers", label: "Followers", active: followers },
          { href: "/dashboard/analytics?tab=finance", label: "Finance", active: finance },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              t.active ? "border-brand text-snow" : "border-transparent text-mist hover:text-snow"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {followers ? (
        <FollowerBreakdown
          history={followerHistory}
          readings={getFollowerCountsOn(site.id, onDay)}
          accounts={getSocialAccounts(site.id)}
          on={onDay}
          error={error}
        />
      ) : finance ? (
        <FinanceTab site={site} />
      ) : (
        <>
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <div className="card !p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-mist">All-time views</p>
          <p className="mt-1.5 text-xl font-bold">{totalViews}</p>
        </div>
        <div className="card !p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-mist">Sections</p>
          <p className="mt-1.5 text-xl font-bold">
            {sections}
            <span className="text-sm font-normal text-mist">
              {" "}/ {plan.maxSections === Infinity ? "∞" : plan.maxSections}
            </span>
          </p>
        </div>
        <div className="card !p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-mist">Subscribers</p>
          <p className="mt-1.5 text-xl font-bold">{subscribers ?? "—"}</p>
          {subscribers === null && <p className="text-xs text-mist">Enterprise</p>}
        </div>
        <div className="card !p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-mist">Chat messages</p>
          <p className="mt-1.5 text-xl font-bold">{chatMessages ?? "—"}</p>
          {chatMessages === null && <p className="text-xs text-mist">Enterprise</p>}
        </div>
      </div>

      {plan.dailyAnalytics ? (
        <div className="mt-6">{chartCard}</div>
      ) : (
        <LockedOverlay plan="Pro" className="mt-6">{chartCard}</LockedOverlay>
      )}

      {plan.referrerAnalytics ? (
        <div className="mt-6">{referrerCard}</div>
      ) : (
        <LockedOverlay plan="Enterprise" className="mt-6">{referrerCard}</LockedOverlay>
      )}

      {/* Numbers over time, which is what this tab is for. It used to sit in
          Socials under the publishing tools it has nothing to do with. */}
      {plan.social && (
        <div className="mt-6">
          <SocialGrowth accounts={getSocialAccounts(site.id)} stats={getSocialStats(site.id)} />
        </div>
      )}
        </>
      )}
    </div>
  );
}
