import Link from "next/link";
import { ADMIN_EMAIL, requireUser } from "@/lib/auth";
import { logout } from "@/lib/actions";
import { getAllQuotes, getAllTickets, getSiteByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  const plan = site ? getPlan(site.plan) : null;
  const isAdmin = user.email === ADMIN_EMAIL;
  // Only counted for the admin — these read every row in the table.
  const openQuotes = isAdmin ? getAllQuotes().filter((q) => q.status === "new").length : 0;
  const openTickets = isAdmin ? getAllTickets().filter((t) => t.status === "open").length : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-mist">Your account — who you are, what you&apos;re on, and how to sign out.</p>

      <div className="mt-6 space-y-5">
        <ProfileForm name={user.name} businessName={user.businessName} />

        <div className="card">
          <h2 className="font-bold">Account</h2>
          <dl className="mt-3 divide-y divide-edge text-sm">
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-mist">Email</dt>
              <dd className="truncate font-medium">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-mist">Plan</dt>
              <dd className="font-medium">
                {plan ? `${plan.name} — $${plan.price}/month` : "No page yet"}
                {plan && (
                  <Link href="/dashboard/settings" className="ml-3 text-xs font-semibold text-brand hover:underline">
                    Change
                  </Link>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-mist">Member since</dt>
              <dd className="font-medium">{user.createdAt.slice(0, 10)}</dd>
            </div>
          </dl>
        </div>

        {/* The admin inbox used to be its own sidebar row. It's account-level,
            not a page tool, so it lives here now — visible to the admin only. */}
        {isAdmin && (
          <div className="card border-warn/40">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-warn">Admin inbox</h2>
                <p className="mt-1 text-sm text-mist">
                  {openQuotes + openTickets === 0
                    ? "Quote requests and Enterprise support tickets — nothing open right now."
                    : [
                        openQuotes && `${openQuotes} new quote${openQuotes === 1 ? "" : "s"}`,
                        openTickets && `${openTickets} open ticket${openTickets === 1 ? "" : "s"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
              </div>
              <Link href="/admin" className="btn-primary !py-2 text-sm">
                Open inbox
              </Link>
            </div>
          </div>
        )}

        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-bold">Sign out</h2>
              <p className="mt-1 text-sm text-mist">End this session on this device.</p>
            </div>
            <form action={logout}>
              <button className="btn-ghost !py-2 text-sm">Sign out</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
