"use client";

import { useActionState } from "react";
import { subscribeAction, type FormState } from "@/lib/actions";

export function NewsletterSignup({ siteId, buttonLabel }: { siteId: number; buttonLabel: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(subscribeAction, {});

  if (state.ok) {
    return <p className="mt-6 text-center font-semibold text-white/90">You&apos;re in — check your inbox soon.</p>;
  }

  return (
    <form action={formAction} className="mx-auto mt-6 w-full max-w-md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="siteId" value={siteId} />
        <input
          className="w-full flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-white/40"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
        />
        <button
          className="rounded-xl px-6 py-3 font-semibold text-white transition hover:opacity-90"
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
