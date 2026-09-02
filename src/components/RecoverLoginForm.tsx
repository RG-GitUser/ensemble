"use client";

import { useActionState } from "react";
import { recoverLogin, type FormState } from "@/lib/actions";

/** Set the login address and password together, off a recovery link. */
export function RecoverLoginForm({ token, currentEmail }: { token: string; currentEmail: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(recoverLogin, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="email">Login address</label>
        {/* Pre-filled with the current one, so keeping it is the default and
            "I just needed to be reminded" costs no typing. */}
        <input
          className="field"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={currentEmail}
          required
        />
      </div>
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
        {pending ? "One moment…" : "Save and sign me in"}
      </button>
      <p className="text-xs text-mist/70">
        This ends every signed-in session on the account, and tells the old address it changed.
      </p>
    </form>
  );
}
