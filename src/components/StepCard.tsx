import { CheckIcon } from "@/components/icons";

/**
 * A numbered step in a setup flow. Completed steps collapse to their summary
 * line so a finished checklist stays short, while the step you're on — and
 * any step you've already finished but might want to revisit — opens on click.
 *
 * Native <details> so it works without JavaScript and stays keyboard-usable.
 */
export function StepCard({
  n,
  done,
  title,
  summary,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  /** One-line state shown next to the title, open or closed. */
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      // Unfinished steps start open — that's where the user's attention goes.
      open={!done}
      className={`card group !p-0 ${done ? "border-good/25" : ""}`}
    >
      <summary className="no-marker flex cursor-pointer list-none items-center gap-3 p-5">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            done ? "bg-good/20 text-good" : "border border-edge text-mist"
          }`}
          aria-hidden
        >
          {done ? <CheckIcon /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-bold ${done ? "text-mist" : "text-snow"}`}>{title}</span>
          {summary && <span className="mt-0.5 block truncate text-xs text-mist">{summary}</span>}
        </span>
        <span aria-hidden className="shrink-0 text-mist transition group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="border-t border-edge p-5">{children}</div>
    </details>
  );
}
