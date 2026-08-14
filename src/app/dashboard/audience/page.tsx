import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLeads, getSiteByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { deleteLeadAction } from "@/lib/actions";
import { UpgradeGate } from "@/components/UpgradeGate";
import { CloseIcon } from "@/components/icons";

export default async function AudiencePage() {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");
  const plan = getPlan(site.plan);

  if (!plan.newsletter) {
    return (
      <UpgradeGate
        title="Audience"
        requiredPlan="Enterprise"
        body="Collect subscriber emails from Newsletter sections on your page, manage your list and export it any time."
      />
    );
  }

  const leads = getLeads(site.id);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audience</h1>
          <p className="mt-1 text-sm text-mist">
            {leads.length} subscriber{leads.length === 1 ? "" : "s"} from your page&apos;s Newsletter sections.
          </p>
        </div>
        {leads.length > 0 && (
          <a href="/dashboard/audience/export" className="btn-ghost !py-2 text-sm" download>
            Export CSV
          </a>
        )}
      </div>

      <div className="card mt-6">
        {leads.length === 0 ? (
          <p className="text-sm text-mist">
            No signups yet — add a Newsletter section in the Page Builder and publish your page.
          </p>
        ) : (
          <ul className="divide-y divide-edge text-sm">
            {leads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                <span>{l.email}</span>
                <span className="flex items-center gap-4">
                  <span className="text-mist">{l.createdAt.slice(0, 10)}</span>
                  <form action={deleteLeadAction}>
                    <input type="hidden" name="leadId" value={l.id} />
                    <button
                      className="text-mist transition hover:text-brand2"
                      title="Remove subscriber"
                      aria-label="Remove subscriber"
                    >
                      <CloseIcon />
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
