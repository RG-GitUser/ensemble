import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  countChatMessages,
  countLeads,
  countSections,
  getDailyViews,
  getSiteByUser,
  getTopReferrers,
  getTotalViews,
} from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { LockedOverlay } from "@/components/LockedOverlay";

const CHART_DAYS = 30;

function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");
  const plan = getPlan(site.plan);

  const totalViews = getTotalViews(site.id);
  const sections = countSections(site.id);
  const subscribers = plan.newsletter ? countLeads(site.id) : null;
  const chatMessages = plan.chatroom ? countChatMessages(site.id) : null;

  // Fill the last CHART_DAYS days so the chart shows gaps, not just active days.
  // Fetched on every plan — lower tiers see it dimmed behind the upgrade overlay.
  const daily = getDailyViews(site.id, CHART_DAYS);
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

  const referrers = getTopReferrers(site.id);

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
      <p className="mt-1 text-sm text-mist">How your page is doing.</p>

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
    </div>
  );
}
