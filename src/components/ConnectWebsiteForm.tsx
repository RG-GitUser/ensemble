"use client";

import { useActionState } from "react";
import { connectWebsite, rescanWebsite, type FormState } from "@/lib/actions";

export function ConnectWebsiteForm({ initialUrl }: { initialUrl?: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(connectWebsite, {});
  return (
    <form action={formAction} className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="field flex-1"
          name="url"
          type="text"
          defaultValue={initialUrl}
          placeholder="https://www.mywebsite.com"
          required
        />
        <button className="btn-primary !py-2 text-sm" disabled={pending}>
          {pending ? "Scanning…" : initialUrl ? "Change & rescan" : "Load my site"}
        </button>
      </div>
      {state.error && (
        <p className="mt-3 rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function RescanButton() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(rescanWebsite, {});
  return (
    <form action={formAction} className="inline">
      <button className="btn-ghost !py-2 text-sm" disabled={pending}>
        {pending ? "Rescanning…" : "Rescan website"}
      </button>
      {state.error && <p className="mt-2 text-sm text-brand2">{state.error}</p>}
    </form>
  );
}
