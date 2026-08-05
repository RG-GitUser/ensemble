"use client";

import { useActionState } from "react";
import { createTicketAction, type FormState } from "@/lib/actions";

export function SupportTicketForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createTicketAction, {});

  if (state.ok) {
    return (
      <div className="card border-good/40 bg-good/5">
        <p className="font-semibold text-good">Ticket received</p>
        <p className="mt-1 text-sm text-mist">We&apos;ll get back to you by email — replies also show up below.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="font-bold">Open a ticket</h2>
      <div>
        <label className="label">Subject</label>
        <input className="field" name="subject" maxLength={120} placeholder="What do you need help with?" required />
      </div>
      <div>
        <label className="label">Message</label>
        <textarea
          className="field min-h-28"
          name="body"
          maxLength={2000}
          placeholder="Describe the problem or question — include your page URL if it's about a specific section."
          required
        />
      </div>
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      <button className="btn-primary !py-2 text-sm" disabled={pending}>
        {pending ? "Sending…" : "Send ticket"}
      </button>
    </form>
  );
}
