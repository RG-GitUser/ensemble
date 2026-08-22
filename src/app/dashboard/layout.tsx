import Link from "next/link";
import { ADMIN_EMAIL, requireUser } from "@/lib/auth";
import { logout } from "@/lib/actions";
import { getSiteByUser, getUserPrefs } from "@/lib/db";
import { getPlan, type PlanDef } from "@/lib/plans";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TourGuide } from "@/components/TourGuide";
import { WelcomeDialog } from "@/components/WelcomeDialog";

/** Kept in step with setupSteps() on the dashboard, which builds exactly six. */
const SETUP_STEPS = 6;

const NAV: Array<{ href: string; label: string; requires?: keyof PlanDef; badge?: string }> = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/socials", label: "Socials", requires: "social", badge: "Pro" },
  { href: "/dashboard/builder", label: "Page Builder" },
  { href: "/dashboard/connect", label: "My Website" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/audience", label: "Audience", requires: "newsletter", badge: "Ent" },
  { href: "/dashboard/chatroom", label: "Chatroom", requires: "chatroom", badge: "Ent" },
  { href: "/dashboard/integrations", label: "Integrations" },
  { href: "/dashboard/support", label: "Support", requires: "helpdesk", badge: "Ent" },
  { href: "/dashboard/settings", label: "Settings" },
];

/**
 * Sidebar rows are deliberately flat — no fill, no border. What marks the
 * active/hovered one is a short accent rail that grows in at the left edge,
 * which reads at a glance without putting a box around every item.
 */
const NAV_LINK =
  "group relative flex items-center justify-between gap-3 whitespace-nowrap rounded-lg py-2.5 pl-4 pr-3 text-sm font-medium text-mist transition hover:bg-panel2 hover:text-snow";

/** Account-level rows sit apart from the page tools and carry their own colour. */
const NAV_LINK_ACCOUNT = NAV_LINK.replace("text-mist", "text-warn") + " hover:!text-warn";

/** The rail itself — collapsed to nothing until the row is hovered. */
function Rail({ tone = "bg-brand" }: { tone?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute left-1 top-1/2 h-0 w-[3px] -translate-y-1/2 rounded-full ${tone} transition-all duration-150 group-hover:h-5`}
    />
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  const plan = site ? getPlan(site.plan) : null;
  const prefs = getUserPrefs(user.id);

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-edge bg-panel/60 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 px-6 pb-2 pt-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
          </Link>
          <ThemeToggle />
        </div>
        <p className="truncate px-6 pb-4 text-xs text-mist">{user.businessName}</p>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map((n) => {
            const locked = n.requires ? !plan || !plan[n.requires] : false;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={NAV_LINK}
              >
                <Rail />
                {n.label}
                {locked && (
                  <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold uppercase text-warn">
                    {n.badge}
                  </span>
                )}
              </Link>
            );
          })}
          {/* Account-level, so it sits below the page tools with a divider and
              its own colour. The admin inbox now lives inside it. */}
          <span aria-hidden className="my-1 hidden h-px bg-edge md:block" />
          <Link href="/dashboard/profile" className={NAV_LINK_ACCOUNT}>
            <Rail tone="bg-warn" />
            Profile
            {user.email === ADMIN_EMAIL && (
              <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold uppercase text-warn">
                Admin
              </span>
            )}
          </Link>
        </nav>
        <form action={logout} className="p-3 md:mt-auto">
          <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-mist transition hover:bg-panel2 hover:text-snow">
            ← Sign out
          </button>
        </form>
      </aside>
      {/* min-w-0: a flex item defaults to min-width:auto, so one long
          unbreakable line (a code snippet, a wide table) propagates its
          min-content width up and scrolls the whole dashboard sideways.
          This lets those blocks scroll inside their own box instead. */}
      <main className="min-w-0 flex-1 px-6 py-8 md:px-10">{children}</main>
      {/* Mounted once for the whole dashboard: it picks the tour matching the
          current route, and shows nothing at all once they've been seen or
          switched off in Settings. It waits for the welcome to be answered,
          so bubbles never open underneath the dialog offering them. */}
      <TourGuide seen={prefs.toursSeen} enabled={prefs.tutorialsEnabled && prefs.welcomed} />
      {/* Only once a site exists — someone still in onboarding has no
          dashboard to be walked through yet. */}
      {site && !prefs.welcomed && (
        <WelcomeDialog firstName={user.name.split(" ")[0]} steps={SETUP_STEPS} />
      )}
    </div>
  );
}
