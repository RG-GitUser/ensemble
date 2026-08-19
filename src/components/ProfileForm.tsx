"use client";

import { useActionState } from "react";
import { updateProfile, type FormState } from "@/lib/actions";

export function ProfileForm({ name, businessName }: { name: string; businessName: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateProfile, {});
  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="font-bold">Your details</h2>
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input className="field" id="name" name="name" defaultValue={name} maxLength={80} required />
      </div>
      <div>
        <label className="label" htmlFor="businessName">Business name</label>
        <input
          className="field"
          id="businessName"
          name="businessName"
          defaultValue={businessName}
          maxLength={80}
          required
        />
        <p className="mt-1 text-xs text-mist/70">Shown in your dashboard sidebar and on your public page.</p>
      </div>
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      {state.ok && <p className="text-sm font-semibold text-good">Profile saved.</p>}
      <button className="btn-primary !py-2 text-sm" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
