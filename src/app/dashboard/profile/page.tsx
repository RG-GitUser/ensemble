import Link from "next/link";
import { ADMIN_EMAIL, requireUser } from "@/lib/auth";
import { deleteMyAccount, deleteMyData, logout } from "@/lib/actions";
import { getAllQuotes, getAllTickets, getSiteByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { DangerButton } from "@/components/DangerButton";
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

        {/* The two deletions the privacy page promises, self-serve. Both sit
            behind DangerButton's modal, so neither is ever one click. */}
        <div className="card border-brand2/30">
          <h2 className="font-bold text-brand2">Danger zone</h2>
          <div className="mt-3 divide-y divide-edge">
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <h3 className="text-sm font-semibold">Delete collected data</h3>
                <p className="mt-0.5 text-sm text-mist">
                  Wipes analytics, subscriber emails, chat messages, connected social accounts and their stored
                  credentials, post history and the growth log. Your account, page and design stay.
                </p>
              </div>
              <DangerButton
                label="Delete data"
                title="Delete all collected data?"
                body="Analytics, subscriber emails, chat messages, connected social accounts (credentials included), your posting history and your growth log are permanently deleted. Your account, your page and its design are not touched. There is no undo."
                confirmLabel="Yes, delete my data"
                action={deleteMyData}
                className="btn-ghost !py-2 text-sm !text-brand2"
              />
            </div>
            {!isAdmin && (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <h3 className="text-sm font-semibold">Delete account</h3>
                  <p className="mt-0.5 text-sm text-mist">
                    Permanently deletes your account, your page, your domain claim and everything collected.
                    {plan && site?.billingStatus === "active"
                      ? " Cancel your subscription in Settings first so billing stops cleanly."
                      : ""}
                  </p>
                </div>
                <DangerButton
                  label="Delete account"
                  title="Delete your whole account?"
                  body="Your account, your published page, your domain claim, every connected credential and everything ever collected are permanently deleted, and you are signed out. This cannot be undone and nothing is recoverable afterwards."
                  confirmLabel="Yes, delete everything"
                  action={deleteMyAccount}
                  className="btn-ghost !py-2 text-sm !text-brand2"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
