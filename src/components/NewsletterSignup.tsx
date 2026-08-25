"use client";

import { useActionState } from "react";
import { subscribeAction, type FormState } from "@/lib/actions";

export function NewsletterSignup({ siteId, buttonLabel }: { siteId: number; buttonLabel: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(subscribeAction, {});

  if (state.ok) {
    return <p className="mt-6 text-center font-semibold site-ink">You&apos;re in — check your inbox soon.</p>;
  }

  return (
    <form action={formAction} className="site-btn-group mt-6 w-full max-w-md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="siteId" value={siteId} />
        <input
          className="site-field w-full flex-1 rounded-xl px-4 py-3"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
        />
        <button
          className="site-btn rounded-xl px-6 py-3 font-semibold text-white transition hover:opacity-90"
          style={{ background: "var(--site-accent)" }}
          disabled={pending}
        >
          {pending ? "…" : buttonLabel || "Subscribe"}
        </button>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-300">{state.error}</p>}
    </form>
  );
}
