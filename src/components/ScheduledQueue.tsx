import { describeSchedule } from "@/lib/schedule";

/**
 * What is waiting to go out, and the way to stop it.
 *
 * A queue you cannot see is a queue you cannot trust, and the cancel button is
 * the whole reason this renders at all: scheduling something is only safe if
 * calling it off is as easy.
 *
 * An item the runner has already claimed shows as sending and loses its
 * button. The server refuses that cancel anyway - the send may already be
 * out - and a button that reports success after the post went is worse than
 * no button.
 */
export interface QueueItem {
  id: number;
  /** Subject line, or the first of the post's body. */
  label: string;
  publishAt: string;
  status: "scheduled" | "sending";
}

export function ScheduledQueue({
  items,
  zone,
  cancelAction,
  emptyText,
}: {
  items: QueueItem[];
  zone: string;
  cancelAction: (fd: FormData) => Promise<void>;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="mt-3 text-xs text-mist/70">{emptyText}</p>;
  }
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">{item.label}</p>
            <p className="mt-0.5 text-xs text-mist">
              {item.status === "sending" ? "Sending now…" : describeSchedule(item.publishAt, zone)}
            </p>
          </div>
          {item.status === "scheduled" && (
            <form action={cancelAction}>
              <input type="hidden" name="id" value={item.id} />
              <button className="rounded-full border border-line px-3 py-1 text-xs font-bold text-mist transition hover:text-brand2">
                Cancel
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
