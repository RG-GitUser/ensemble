import Link from "next/link";
import { notFound } from "next/navigation";
import { countLeads, countSections, getSiteBySlug, getUserById } from "@/lib/db";
import { getPlan } from "@/lib/plans";

const NAV = ["Overview", "Page Builder", "My Website", "Analytics", "Audience", "Chatroom", "Integrations", "Support", "Settings"];

/** Public, read-only tour of the dashboard using the seeded demo creator. */
export default function DemoDashboardPage() {
  const site = getSiteBySlug("demo");
  if (!site) notFound();
  const owner = getUserById(site.userId);
  const plan = getPlan(site.plan);
  const sectionsUsed = countSections(site.id);
  const leads = plan.newsletter ? countLeads(site.id) : 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-center gap-3 border-b border-brand/30 bg-brand/10 px-4 py-2 text-xs">
        <span className="font-semibold text-brand">You&apos;re touring a read-only demo dashboard</span>
        <Link href="/signup" className="font-semibold underline underline-offset-2 hover:text-snow">
          Create your own
        </Link>
      </div>
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-edge bg-panel/60 md:min-h-full md:w-64 md:border-b-0 md:border-r">
          <Link href="/" className="px-6 pb-2 pt-6 text-lg font-bold tracking-tight">
            En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
          </Link>
          <p className="truncate px-6 pb-4 text-xs text-mist">{owner?.businessName ?? "Demo creator"}</p>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
            {NAV.map((label, i) => (
              <span
                key={label}
                className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium ${
                  i === 0 ? "bg-panel2 text-snow" : "cursor-not-allowed text-mist/60"
                }`}
                title={i === 0 ? undefined : "Sign up to use the full dashboard"}
              >
                {label}
              </span>
            ))}
          </nav>
          <div className="p-3 md:mt-auto">
            <Link
              href="/"
              className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-mist transition hover:bg-panel2 hover:text-snow"
            >
              ← Exit demo
            </Link>
          </div>
        </aside>
        <main className="flex-1 px-6 py-8 md:px-10">
          <div className="mx-auto max-w-4xl">
            <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
            <p className="mt-1 text-sm text-mist">
              Hey {owner?.name.split(" ")[0] ?? "there"} — here&apos;s where {owner?.businessName ?? "your business"} stands.
            </p>

            <div className="card mt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold">Your page</h2>
                  <p className="mt-1 text-sm text-mist">
                    ensemble / <span className="font-mono text-snow">s/{site.slug}</span>
                  </p>
                </div>
                <span className="rounded-full bg-good/15 px-3 py-1 text-xs font-semibold text-good">● Live</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/s/${site.slug}`} className="btn-primary !py-2 text-sm" target="_blank">
                  View the live page ↗
                </Link>
                <Link href="/signup" className="btn-ghost !py-2 text-sm">
                  Build one like it
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
                <p className="text-sm text-mist">{plan.maxSections === Infinity ? "Unlimited" : "on this plan"}</p>
              </div>
              <div className="card !p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-mist">Subscribers</p>
                <p className="mt-1.5 text-xl font-bold">{plan.newsletter ? leads : "—"}</p>
                <p className="text-sm text-mist">{plan.newsletter ? "newsletter signups" : "Enterprise feature"}</p>
              </div>
            </div>

            <div className="card mt-6">
              <h2 className="font-bold">This is the real dashboard</h2>
              <p className="mt-1 text-sm text-mist">
                Everything above is live data from the example creator page. When you sign up you get this exact
                dashboard — plus the Page Builder, integrations and settings — for your own page.
              </p>
              <Link href="/signup" className="btn-primary mt-4 !py-2 text-sm">
                Get started
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
