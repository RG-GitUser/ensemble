"use client";

import { useTransition } from "react";
import { completeWelcomeAction } from "@/lib/actions";

/**
 * The first thing a new creator sees, once.
 *
 * It exists because the walkthrough used to start on its own: bubbles simply
 * appeared, with no way to know what they were or to say no thanks. Asking
 * first makes the tour something offered rather than something that happens.
 *
 * Answering either way sets `welcomed`, so this never returns. Saying no also
 * switches the bubbles off, since being followed around by tips after
 * declining a tour is the opposite of what was asked for.
 *
 * There is deliberately no backdrop-click or Escape dismissal. Both would
 * leave `welcomed` false and bring the dialog back on the next load, which
 * reads as broken rather than forgiving.
 */
export function WelcomeDialog({ firstName, steps }: { firstName: string; steps: number }) {
  const [pending, start] = useTransition();

  const answer = (takeTour: boolean) => start(() => void completeWelcomeAction(takeTour));

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/80 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="w-full max-w-md rounded-2xl border border-brand/40 bg-panel p-6 shadow-2xl"
      >
        <h2 id="welcome-title" className="text-xl font-bold tracking-tight">
          Welcome, {firstName}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-mist">
          Your page already exists, with a starter layout in place. There are {steps} things to do before it&apos;s
          worth sharing, and the checklist on your dashboard keeps count as you go.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-mist">
          Want a quick walkthrough? It&apos;s a handful of tips pointing at the things you&apos;ll use most.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => answer(true)}
            className="btn-primary flex-1 !py-2.5 text-sm"
          >
            {pending ? "…" : "Show me around"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => answer(false)}
            className="btn-ghost flex-1 !py-2.5 text-sm"
          >
            I&apos;ll explore on my own
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-mist/70">
          Changed your mind later? Tutorials switch back on in Settings.
        </p>
      </div>
    </div>
  );
}
