"use client";

import { useActionState } from "react";
import { resetPassword, type FormState } from "@/lib/actions";

/** Set a new password against a token that the page has already validated. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(resetPassword, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input
          className="field"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input
          className="field"
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Type it again"
          required
        />
      </div>
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "One moment…" : "Set my new password"}
      </button>
      <p className="text-xs text-mist/70">
        Setting a new password signs you out everywhere else, on every device.
      </p>
    </form>
  );
}
