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
  fields,
  className = "btn-ghost !py-1.5 !px-3 text-xs !text-brand2",
}: {
  /** What opens the warning. A node, so a whole tile can be the trigger. */
  label: React.ReactNode;
  title: string;
  /** What will be lost, in plain words. */
  body: string;
  /** The button that actually does it. */
  confirmLabel: string;
  /** Server action run on confirm. An action taking no arguments still fits. */
  action: (fd: FormData) => Promise<void>;
  /** Hidden inputs the action needs, such as which section to remove. */
  fields?: Record<string, string>;
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
        // m-auto is load-bearing. A modal <dialog> is centred by the browser's
        // own `margin: auto`, and Tailwind's preflight resets every margin to
        // zero, which drops the box in the top-left corner. Putting the margin
        // back is what centres it; there is nothing else holding it in place.
        className="m-auto max-w-sm rounded-2xl border border-edge bg-panel p-0 text-snow backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="p-5">
          <h3 className="font-bold text-brand2">{title}</h3>
          <p className="mt-2 text-sm text-mist">{body}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost !py-2 text-sm" onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <form action={action}>
              {Object.entries(fields ?? {}).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
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
