import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSiteByUser, getTicketsByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { SupportTicketForm } from "@/components/SupportTicketForm";
import { UpgradeGate } from "@/components/UpgradeGate";

const STATUS_TONE: Record<string, string> = {
  open: "bg-warn/15 text-warn",
  answered: "bg-good/15 text-good",
  closed: "bg-panel2 text-mist",
};

export default async function SupportPage() {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");
  const plan = getPlan(site.plan);

  if (!plan.helpdesk) {
    return (
      <UpgradeGate
        title="Support"
        requiredPlan="Enterprise"
        body="Priority help desk — open tickets from your dashboard and get answers from a real person, fast."
      />
    );
  }

  const tickets = getTicketsByUser(user.id);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">Support</h1>
      <p className="mt-1 text-sm text-mist">
        Priority help desk, included with Enterprise. We reply here and to {user.email}.
      </p>

      <div className="mt-6 space-y-6">
        <SupportTicketForm />

        <div>
          <h2 className="font-bold">Your tickets</h2>
          {tickets.length === 0 ? (
            <div className="card mt-3 text-sm text-mist">No tickets yet.</div>
          ) : (
            <div className="mt-3 space-y-4">
              {tickets.map((t) => (
                <div key={t.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-bold">{t.subject}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_TONE[t.status]}`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-mist">{t.createdAt.slice(0, 16).replace("T", " ")}</p>
                  <p className="mt-3 whitespace-pre-line text-sm text-mist">{t.body}</p>
                  {t.reply && (
                    <div className="mt-4 rounded-xl border border-good/30 bg-good/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-good">Support reply</p>
                      <p className="mt-1 whitespace-pre-line text-sm">{t.reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
