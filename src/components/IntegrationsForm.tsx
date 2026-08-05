"use client";

import { useActionState } from "react";
import { updateIntegrations, type FormState } from "@/lib/actions";

export function IntegrationsForm({
  payments,
  calendar,
  chatroom,
  newsletter,
  stripeKey,
  calendlyUrl,
  chatroomEnabled,
  newsletterEnabled,
}: {
  payments: boolean;
  calendar: boolean;
  chatroom: boolean;
  newsletter: boolean;
  stripeKey: string;
  calendlyUrl: string;
  chatroomEnabled: boolean;
  newsletterEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateIntegrations, {});
  return (
    <form action={formAction} className="space-y-5">
      {payments && (
        <div className="card">
          <h2 className="font-bold">💳 Stripe payments</h2>
          <p className="mt-1 text-sm text-mist">
            Paste your Stripe publishable key to brand your checkout, then add Stripe payment links to merch items in
            the Page Builder (Name | Price | Image | <span className="font-mono">https://buy.stripe.com/…</span>).
          </p>
          <input
            className="field mt-3 font-mono text-sm"
            name="stripeKey"
            defaultValue={stripeKey}
            placeholder="pk_live_..."
          />
        </div>
      )}
      {calendar && (
        <div className="card">
          <h2 className="font-bold">📅 Calendar</h2>
          <p className="mt-1 text-sm text-mist">
            Default calendar link used by Event Calendar sections when they don&apos;t set their own.
          </p>
          <input className="field mt-3" name="calendlyUrl" defaultValue={calendlyUrl} placeholder="https://calendly.com/you" />
        </div>
      )}
      {chatroom && (
        <div className="card flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold">💬 Community chatroom</h2>
            <p className="mt-1 text-sm text-mist">Show the chatroom space on your page&apos;s Chatroom sections.</p>
          </div>
          <input type="checkbox" name="chatroomEnabled" defaultChecked={chatroomEnabled} className="h-5 w-5 accent-brand" />
        </div>
      )}
      {newsletter && (
        <div className="card flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold">💌 Newsletter / memberships</h2>
            <p className="mt-1 text-sm text-mist">Let followers subscribe from Newsletter sections on your page.</p>
          </div>
          <input type="checkbox" name="newsletterEnabled" defaultChecked={newsletterEnabled} className="h-5 w-5 accent-brand" />
        </div>
      )}
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      <button className="btn-primary !py-2 text-sm" disabled={pending}>
        {pending ? "Saving…" : "Save integrations"}
      </button>
    </form>
  );
}
