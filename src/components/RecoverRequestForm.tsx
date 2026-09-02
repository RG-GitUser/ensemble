"use client";

import { useActionState } from "react";
import { requestLoginRecovery, type FormState } from "@/lib/actions";

/** Ask for a recovery link, sent to the account's confirmed backup address. */
export function RecoverRequestForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(requestLoginRecovery, {});

  if (state.ok) {
    return (
      <div className="rounded-xl border border-good/40 bg-good/10 px-4 py-3">
        <p className="text-sm text-snow">{state.message}</p>
        <p className="mt-1.5 text-xs text-mist">
          The link works once and expires in 45 minutes. Check your spam folder if it hasn&apos;t arrived shortly.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Recovery address</label>
        <input
          className="field"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="your-other@example.com"
          required
        />
      </div>
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "One moment…" : "Send me a way back in"}
      </button>
    </form>
  );
}
