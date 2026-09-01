"use client";

import { useActionState, useState } from "react";
import { updateIntegrations, type FormState } from "@/lib/actions";
import { EMAIL_PROVIDERS, getEmailProvider } from "@/lib/email-providers";

export function IntegrationsForm({
  payments,
  calendar,
  newsletter,
  stripeKey,
  calendlyUrl,
  newsletterEnabled,
  emailProvider,
  emailApiKey,
  emailListId,
}: {
  payments: boolean;
  calendar: boolean;
  newsletter: boolean;
  stripeKey: string;
  calendlyUrl: string;
  newsletterEnabled: boolean;
  emailProvider: string;
  emailApiKey: string;
  emailListId: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateIntegrations, {});
  // Which provider is picked decides what the two fields below are called and
  // where to tell someone to find them, so it has to be live rather than a
  // static label.
  const [provider, setProvider] = useState(emailProvider);
  const providerDef = getEmailProvider(provider);
  return (
    <form action={formAction} className="space-y-5">
      {payments && (
        <div className="card">
          <h2 className="font-bold">Stripe payments</h2>
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
          <h2 className="font-bold">Calendar</h2>
          <p className="mt-1 text-sm text-mist">
            Default calendar link used by Event Calendar sections when they don&apos;t set their own.
          </p>
          <input className="field mt-3" name="calendlyUrl" defaultValue={calendlyUrl} placeholder="https://calendly.com/you" />
        </div>
      )}
      {newsletter && (
        <div className="card">
          <h2 className="font-bold">Your email platform</h2>
          <p className="mt-1 text-sm text-mist">
            Optional, and additive. Subscribers are always stored here and exportable as CSV. Connect the platform
            you already run your list on and every new signup is copied across, so Ensemble grows your audience
            where it already lives instead of holding it hostage.
          </p>
          <select
            className="field mt-3"
            name="emailProvider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="">Not connected</option>
            {EMAIL_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {providerDef && (
            <>
              <label className="mt-3 block">
                <span className="label">{providerDef.keyLabel}</span>
                <input
                  className="field font-mono text-sm"
                  name="emailApiKey"
                  defaultValue={emailApiKey}
                  placeholder={providerDef.keyLabel}
                />
                <span className="mt-1 block text-xs text-mist/70">{providerDef.keyHint}</span>
              </label>
              {providerDef.listLabel && (
                <label className="mt-3 block">
                  <span className="label">{providerDef.listLabel}</span>
                  <input
                    className="field font-mono text-sm"
                    name="emailListId"
                    defaultValue={emailListId}
                    placeholder={providerDef.listLabel}
                  />
                  <span className="mt-1 block text-xs text-mist/70">{providerDef.listHint}</span>
                </label>
              )}
              <a
                href={providerDef.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs text-brand underline underline-offset-2"
              >
                {providerDef.name} docs ↗
              </a>
            </>
          )}
        </div>
      )}
      {newsletter && (
        <div className="card flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold">Newsletter / memberships</h2>
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
