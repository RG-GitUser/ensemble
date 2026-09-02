"use client";

import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/lib/actions";

/**
 * Ask for a reset link.
 *
 * On success the form is replaced by the confirmation rather than left on
 * screen with a message under it: the same wording comes back whether or not
 * the address has an account, so leaving a "Send" button under it invites
 * someone to try a second address and compare the two responses. There is
 * nothing to compare, and taking the button away says so.
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});

  if (state.ok) {
    return (
      <div className="rounded-xl border border-good/40 bg-good/10 px-4 py-3">
        <p className="text-sm text-snow">{state.message}</p>
        <p className="mt-1.5 text-xs text-mist">
          The link works once and expires in 45 minutes. Check your spam folder if it hasn&apos;t arrived in a minute or
          two.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input
          className="field"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </div>
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "One moment…" : "Email me a reset link"}
      </button>
    </form>
  );
}
