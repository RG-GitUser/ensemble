"use client";

import { useActionState } from "react";
import { connectFinanceStripe, type FormState } from "@/lib/actions";

export function FinanceConnectForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(connectFinanceStripe, {});
  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input
        className="field font-mono text-sm"
        name="financeStripeKey"
        placeholder="rk_live_... (restricted key recommended)"
        required
      />
      <p className="text-xs text-mist/70">
        Create a <span className="text-mist">restricted key</span> in your Stripe dashboard with read access to
        Balance and Charges — Ensemble never needs write access to your money.
      </p>
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      <button className="btn-primary !py-2 text-sm" disabled={pending}>
        {pending ? "Checking key…" : "Connect Stripe"}
      </button>
    </form>
  );
}
