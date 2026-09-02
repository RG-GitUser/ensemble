import Link from "next/link";
import { redirect } from "next/navigation";
import { ADMIN_EMAIL, requireUser } from "@/lib/auth";
import { getAllQuotes, getAllTickets } from "@/lib/db";
import { markQuote, replyTicket, setTicketStatus } from "@/lib/actions";
import { quoteAccessLabel, quotePlatformLabel } from "@/lib/quotes";
import { billingEnabled } from "@/lib/billing";
import { mailEnabled } from "@/lib/mailer";

const STATUSES = ["new", "quoted", "closed"] as const;
const TICKET_STATUSES = ["open", "answered", "closed"] as const;

/**
 * What this server currently has switched on.
 *
 * Every one of these is an env var that silently changes how the platform
 * behaves, and none of them were visible anywhere: the way to find out whether
 * the launch was still held, or why no reset emails were arriving, was to read
 * .env on the droplet or infer it from behaviour. A creator hitting a redirect
 * cannot tell WIP mode from a bug, and neither could we.
 *
 * Deliberately reports only on/off. Reading the values themselves — keys,
 * secrets, addresses — into a page would be a worse problem than the one this
 * solves.
 */
function ServerState() {
  const wip = process.env.WIP_MODE === "1";
  const rows: Array<{ label: string; on: boolean; onText: string; offText: string; warn?: boolean }> = [
    {
      label: "Launch",
      on: !wip,
      onText: "Open — signup and dashboard reachable",
      offText: "Held (WIP_MODE=1) — signed-out visitors go to the landing page",
      warn: wip,
    },
    {
      label: "Billing",
      on: billingEnabled(),
      onText: "Live — Stripe is connected",
      offText: "Preview mode — plan changes are instant and free, pages publish unbilled",
    },
    {
      label: "Email",
      on: mailEnabled(),
      onText: "Sending — resets, recovery and newsletters go out",
      offText: "Off — no password resets or recovery mail can be delivered",
    },
    {
      label: "Live relay",
      on: !!process.env.LIVE_INGEST_URL && !!process.env.LIVE_HOOK_SECRET,
      onText: "Configured — creators can simulcast",
      offText: "Not configured — the dashboard shows the 'nearly here' state",
    },
  ];

  return (
    <>
      <h2 className="mt-10 text-lg font-bold">This server</h2>
      <p className="mt-1 text-sm text-mist">
        Set in <span className="font-mono text-snow">/srv/ensemble/.env</span>. Changing one needs a{" "}
        <span className="font-mono text-snow">systemctl restart ensemble</span>, not a rebuild.
      </p>
      <div className="card mt-4 divide-y divide-edge !p-0">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="w-24 shrink-0 text-sm font-semibold">{r.label}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                r.warn ? "bg-warn/15 text-warn" : r.on ? "bg-good/15 text-good" : "bg-mist/15 text-mist"
              }`}
            >
              {r.on ? "On" : "Off"}
            </span>
            <span className="min-w-0 flex-1 text-sm text-mist">{r.on ? r.onText : r.offText}</span>
          </div>
        ))}
      </div>
      {wip && (
        <p className="mt-2 text-xs text-mist/70">
          To go live: set <span className="font-mono text-snow">WIP_MODE=0</span> (or delete the line) and restart.
        </p>
      )}
    </>
  );
}

export default async function AdminPage() {
  const user = await requireUser();
  if (user.email !== ADMIN_EMAIL) redirect("/dashboard");
  const quotes = getAllQuotes();
  const tickets = getAllTickets();

  return (
    <div className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin inbox</h1>
          <p className="mt-1 text-sm text-mist">Quote requests and Enterprise support tickets.</p>
        </div>
        <Link href="/dashboard" className="btn-ghost !py-2 text-sm">← Dashboard</Link>
      </div>

      <ServerState />

      <h2 className="mt-10 text-lg font-bold">Support tickets</h2>
      {tickets.length === 0 ? (
        <div className="card mt-4 text-center text-mist">No tickets.</div>
      ) : (
        <div className="mt-4 space-y-4">
          {tickets.map((t) => (
            <div key={t.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{t.subject}</p>
                  <p className="mt-0.5 text-sm text-mist">
                    <a href={`mailto:${t.userEmail}`} className="text-brand hover:underline">{t.userEmail}</a>
                    {" · "}{t.userName}
                  </p>
                </div>
                <span className="text-xs text-mist">{t.createdAt.slice(0, 16).replace("T", " ")}</span>
              </div>
              <p className="mt-3 whitespace-pre-line rounded-xl bg-panel2 p-3 text-sm text-mist">{t.body}</p>
              <form action={replyTicket} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="ticketId" value={t.id} />
                <textarea
                  name="reply"
                  defaultValue={t.reply}
                  placeholder="Write a reply…"
                  className="field min-h-16 flex-1 text-sm"
                />
                <button className="btn-ghost self-start !py-2 text-sm">Send reply</button>
              </form>
              <div className="mt-3 flex items-center gap-2">
                {TICKET_STATUSES.map((s) => (
                  <form key={s} action={setTicketStatus}>
                    <input type="hidden" name="ticketId" value={t.id} />
                    <input type="hidden" name="status" value={s} />
                    <button
                      disabled={t.status === s}
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                        t.status === s
                          ? "bg-brand/20 text-brand"
                          : "border border-edge text-mist hover:border-brand/60 hover:text-snow"
                      }`}
                    >
                      {s}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-10 text-lg font-bold">Quote requests</h2>
      {quotes.length === 0 ? (
        <div className="card mt-8 text-center text-mist">No quote requests yet.</div>
      ) : (
        <div className="mt-8 space-y-4">
          {quotes.map((q) => (
            <div key={q.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">
                    {q.businessName} <span className="font-normal text-mist">· {q.name}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-mist">
                    <a href={`mailto:${q.email}`} className="text-brand hover:underline">{q.email}</a>
                    {" · "}
                    <a href={q.websiteUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      {q.websiteUrl}
                    </a>
                  </p>
                </div>
                <span className="text-xs text-mist">{q.createdAt.slice(0, 16).replace("T", " ")}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {q.platform && (
                  <span className="rounded-full bg-panel2 px-2.5 py-1 font-semibold">{quotePlatformLabel(q.platform)}</span>
                )}
                {q.accessMethod && (
                  <span className="rounded-full bg-panel2 px-2.5 py-1 text-mist">{quoteAccessLabel(q.accessMethod)}</span>
                )}
                {q.fileName && (
                  <a
                    href={`/admin/quotes/${q.id}/file`}
                    className="rounded-full bg-brand/15 px-2.5 py-1 font-semibold text-brand hover:bg-brand/25"
                  >
                    Download project zip
                  </a>
                )}
              </div>
              {q.details && <p className="mt-3 whitespace-pre-line rounded-xl bg-panel2 p-3 text-sm text-mist">{q.details}</p>}
              <div className="mt-4 flex items-center gap-2">
                {STATUSES.map((s) => (
                  <form key={s} action={markQuote}>
                    <input type="hidden" name="quoteId" value={q.id} />
                    <input type="hidden" name="status" value={s} />
                    <button
                      disabled={q.status === s}
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                        q.status === s
                          ? "bg-brand/20 text-brand"
                          : "border border-edge text-mist hover:border-brand/60 hover:text-snow"
                      }`}
                    >
                      {s}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
