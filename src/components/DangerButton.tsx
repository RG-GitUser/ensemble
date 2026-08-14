"use client";

import { useEffect, useRef } from "react";

/**
 * A destructive action behind a warning the creator has to read.
 *
 * A native <dialog> rather than window.confirm: confirm() gives a browser-chrome
 * box with no room to say what is actually about to be lost, and some browsers
 * let people suppress it entirely — which would turn "delete everything" into a
 * one-click action. This one is modal (Escape closes it, focus is trapped by
 * the browser), and the confirming button is the only way to submit.
 */
export function DangerButton({
  label,
  title,
  body,
  confirmLabel,
  action,
  className = "btn-ghost !py-1.5 !px-3 text-xs !text-brand2",
}: {
  /** The button that opens the warning. */
  label: string;
  title: string;
  /** What will be lost, in plain words. */
  body: string;
  /** The button that actually does it. */
  confirmLabel: string;
  /** Server action run on confirm. */
  action: () => Promise<void>;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // Clicking the backdrop is the other way people expect to cancel.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClick = (e: MouseEvent) => {
      if (e.target === d) d.close();
    };
    d.addEventListener("click", onClick);
    return () => d.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={ref}
        className="max-w-sm rounded-2xl border border-edge bg-panel p-0 text-snow backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="p-5">
          <h3 className="font-bold text-brand2">{title}</h3>
          <p className="mt-2 text-sm text-mist">{body}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost !py-2 text-sm" onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <form action={action}>
              <button
                className="rounded-xl bg-brand2 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                onClick={() => ref.current?.close()}
              >
                {confirmLabel}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
