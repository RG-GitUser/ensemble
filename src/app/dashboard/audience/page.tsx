import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getActiveLeads, getLeads, getNewsletterPosts, getSiteByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { mailEnabled } from "@/lib/mailer";
import { deleteLeadAction } from "@/lib/actions";
import { NewsletterComposer } from "@/components/NewsletterComposer";
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
        body="Collect subscriber emails from Newsletter sections on your page, write to your whole list right from here, and export it any time."
      />
    );
  }

  const leads = getLeads(site.id);
  const active = getActiveLeads(site.id).length;
  const posts = getNewsletterPosts(site.id);
  const mailReady = mailEnabled();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audience</h1>
          <p className="mt-1 text-sm text-mist">
            {active} subscriber{active === 1 ? "" : "s"} from your page&apos;s Newsletter sections.
          </p>
        </div>
        {leads.length > 0 && (
          <a href="/dashboard/audience/export" className="btn-ghost !py-2 text-sm" download>
            Export CSV
          </a>
        )}
      </div>

      <div className="card mt-6" data-tour="newsletter-compose">
        <h2 className="font-bold">Send a newsletter</h2>
        <p className="mt-1 text-sm text-mist">
          Straight to everyone on your list, from your name, with replies landing in your inbox.
        </p>
        {!mailReady && (
          <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-warn">
            Sending isn&apos;t switched on for this server yet — the operator sets RESEND_API_KEY and MAIL_FROM (see
            .env.example). Your list keeps collecting in the meantime.
          </p>
        )}
        <NewsletterComposer recipients={active} mailReady={mailReady} fromName={user.businessName} />
      </div>

      {posts.length > 0 && (
        <div className="card mt-6">
          <h2 className="font-bold">Sent</h2>
          <ul className="mt-3 divide-y divide-edge text-sm">
            {posts.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate font-medium">{p.subject}</span>
                <span className="shrink-0 text-xs text-mist">
                  {p.sentAt.slice(0, 10)} · {p.recipients} recipient{p.recipients === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card mt-6">
        <h2 className="font-bold">Subscribers</h2>
        {leads.length === 0 ? (
          <p className="mt-3 text-sm text-mist">
            No signups yet — add a Newsletter section in the Page Builder and publish your page.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-edge text-sm">
            {leads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className={l.unsubscribedAt ? "text-mist/50 line-through" : ""}>{l.email}</span>
                <span className="flex items-center gap-4">
                  {l.unsubscribedAt && (
                    <span className="rounded-full bg-panel2 px-2 py-0.5 text-[10px] font-bold uppercase text-mist">
                      Unsubscribed
                    </span>
                  )}
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
