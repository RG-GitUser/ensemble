"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button that confirms it did something.
 *
 * The section forms post a plain Server Action returning void, so a save was
 * completely silent — the page re-rendered with identical content and nothing
 * told you it worked. This watches the form's own pending state and flashes a
 * confirmation on the pending → idle edge.
 *
 * Must be rendered inside the <form> it belongs to: useFormStatus reads the
 * nearest parent form.
 */
export function SaveButton({
  label = "Save section",
  savedLabel = "Saved!",
}: {
  label?: string;
  savedLabel?: string;
}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    // Bumping a counter rather than toggling a boolean means a rapid second
    // save restarts the animation instead of being swallowed while it's
    // already showing.
    setFlash((n) => n + 1);
  }, [pending]);

  useEffect(() => {
    if (flash === 0) return;
    const t = setTimeout(() => setFlash(0), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <div className="flex items-center gap-3">
      <button className="btn-ghost !py-2 text-sm" disabled={pending}>
        {pending ? "Saving…" : label}
      </button>
      <span aria-live="polite" className="text-sm font-semibold text-good">
        {flash > 0 && (
          <span key={flash} className="inline-block animate-[saved-flash_1.8s_ease-in-out_forwards]">
            {savedLabel}
          </span>
        )}
      </span>
    </div>
  );
}
