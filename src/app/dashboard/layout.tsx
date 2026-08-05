import Link from "next/link";
import { ADMIN_EMAIL, requireUser } from "@/lib/auth";
import { logout } from "@/lib/actions";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "🏠" },
  { href: "/dashboard/builder", label: "Page Builder", icon: "🧩" },
  { href: "/dashboard/integrations", label: "Integrations", icon: "🔌" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-edge bg-panel/60 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <Link href="/" className="px-6 pb-2 pt-6 text-lg font-bold tracking-tight">
          Social<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">Construct</span>
        </Link>
        <p className="truncate px-6 pb-4 text-xs text-mist">{user.businessName}</p>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-mist transition hover:bg-panel2 hover:text-snow"
            >
              <span>{n.icon}</span> {n.label}
            </Link>
          ))}
          {user.email === ADMIN_EMAIL && (
            <Link
              href="/admin"
              className="flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-warn transition hover:bg-panel2"
            >
              <span>🛎️</span> Quote Requests
            </Link>
          )}
        </nav>
        <form action={logout} className="p-3 md:mt-auto">
          <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-mist transition hover:bg-panel2 hover:text-snow">
            ← Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 px-6 py-8 md:px-10">{children}</main>
    </div>
  );
}
