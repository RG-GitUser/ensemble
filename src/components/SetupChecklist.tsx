import Link from "next/link";
import { dismissSetupAction } from "@/lib/actions";
import { CheckIcon, CloseIcon } from "@/components/icons";

export interface Checkpoint {
  id: string;
  label: string;
  /** What doing it gets them — shown while it's outstanding. */
  hint: string;
  done: boolean;
  href: string;
  cta: string;
}

/**
 * The road to a finished page, as checkpoints.
 *
 * Every checkpoint is derived from what's actually in the database, so the
 * ring can't tell someone they're finished when they aren't. Completed ones
 * collapse to a line; the next unfinished one keeps its explanation and its
 * button.
 *
 * There is one stored flag, and it is deliberately narrow. The dismiss button
 * only appears on a finished list, and the dashboard puts the card back the
 * moment a checkpoint stops being done. So it can put away a card that has
 * nothing left to say, and it can never hide outstanding work.
 */
export function SetupChecklist({ steps }: { steps: Checkpoint[] }) {
  const done = steps.filter((s) => s.done).length;
  const complete = done === steps.length;
  const next = steps.find((s) => !s.done);
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="card relative mt-6" data-tour="setup">
      {/* Nothing to put away until there is nothing left to do. */}
      {complete && (
        <form action={dismissSetupAction} className="absolute right-3 top-3">
          <button
            className="rounded-lg border border-edge px-2 py-1.5 text-mist transition hover:border-brand/60 hover:text-snow"
            title="Hide this — it comes back if a checkpoint stops being done"
            aria-label="Hide the setup checklist"
          >
            <CloseIcon />
          </button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-4">
        {/* A ring rather than a bar: it reads as progress at a glance and
            holds the count in the middle without a second label. */}
        <div
          className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(var(--color-brand) ${pct * 3.6}deg, var(--color-edge) 0deg)`,
          }}
          role="img"
          aria-label={`${done} of ${steps.length} steps done`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-panel text-sm font-bold">
            {done}/{steps.length}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{complete ? "Your profile is set up" : "Set up your profile"}</h2>
          <p className="mt-1 text-sm text-mist">
            {complete ? (
              "Every checkpoint is done. Anything you change from here goes straight to your live page."
            ) : (
              // The count is in the ring already, but the ring is a graphic.
              // Saying it in words is what a screen reader and a glance both get.
              <>
                <span className="font-semibold text-snow">
                  {done} of {steps.length} done.
                </span>{" "}
                {next?.hint ?? ""}
              </>
            )}
          </p>
        </div>
        {next && (
          <Link href={next.href} className="btn-primary shrink-0 !py-2 text-sm">
            {next.cta}
          </Link>
        )}
      </div>

      {!complete && (
        <p className="mt-4 text-xs text-mist/80">
          Stuck on a step? Email{" "}
          <a href="mailto:onboarding@ensemble.it.com" className="text-brand hover:underline">
            onboarding@ensemble.it.com
          </a>{" "}
          — it exists for exactly this.
        </p>
      )}

      <ol className="mt-5 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.id}>
            <Link
              href={s.href}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${
                s.done
                  ? "border-good/30 bg-good/5 text-mist hover:border-good/60"
                  : "border-edge bg-panel2 hover:border-brand/60"
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  s.done ? "bg-good/20 text-good" : "border border-edge text-mist"
                }`}
                aria-hidden
              >
                {s.done ? <CheckIcon /> : ""}
              </span>
              <span className={s.done ? "line-through decoration-mist/40" : "font-medium"}>{s.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
