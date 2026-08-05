import Link from "next/link";
import { redirect } from "next/navigation";
import { ADMIN_EMAIL, requireUser } from "@/lib/auth";
import { getAllQuotes } from "@/lib/db";
import { markQuote } from "@/lib/actions";

const STATUSES = ["new", "quoted", "closed"] as const;

export default async function AdminPage() {
  const user = await requireUser();
  if (user.email !== ADMIN_EMAIL) redirect("/dashboard");
  const quotes = getAllQuotes();

  return (
    <div className="mx-auto max-w-4xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quote requests</h1>
          <p className="mt-1 text-sm text-mist">Creators who want their existing website integrated.</p>
        </div>
        <Link href="/dashboard" className="btn-ghost !py-2 text-sm">← Dashboard</Link>
      </div>

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
