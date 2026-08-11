import Link from "next/link";
import { ADMIN_EMAIL, requireUser } from "@/lib/auth";
import { logout } from "@/lib/actions";
import { getSiteByUser } from "@/lib/db";
import { getPlan, type PlanDef } from "@/lib/plans";

const NAV: Array<{ href: string; label: string; requires?: keyof PlanDef; badge?: string }> = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/builder", label: "Page Builder" },
  { href: "/dashboard/connect", label: "My Website" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/audience", label: "Audience", requires: "newsletter", badge: "Ent" },
  { href: "/dashboard/chatroom", label: "Chatroom", requires: "chatroom", badge: "Ent" },
  { href: "/dashboard/integrations", label: "Integrations" },
  { href: "/dashboard/support", label: "Support", requires: "helpdesk", badge: "Ent" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  const plan = site ? getPlan(site.plan) : null;

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-edge bg-panel/60 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <Link href="/" className="px-6 pb-2 pt-6 text-lg font-bold tracking-tight">
          En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
        </Link>
        <p className="truncate px-6 pb-4 text-xs text-mist">{user.businessName}</p>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map((n) => {
            const locked = n.requires ? !plan || !plan[n.requires] : false;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-mist transition hover:bg-panel2 hover:text-snow"
              >
                {n.label}
                {locked && (
                  <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold uppercase text-warn">
                    {n.badge}
                  </span>
                )}
              </Link>
            );
          })}
          {user.email === ADMIN_EMAIL && (
            <Link
              href="/admin"
              className="flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-warn transition hover:bg-panel2"
            >
              Admin Inbox
            </Link>
          )}
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
    </div>
  );
}
