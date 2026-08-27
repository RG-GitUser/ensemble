"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateSettings, type FormState } from "@/lib/actions";

export function SettingsForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateSettings, {});
  return (
    <form action={formAction} className="card space-y-4">
      <h2 className="font-bold">Page settings</h2>
      <div>
        <label className="label" htmlFor="slug">Page URL</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-mist">/</span>
          <input className="field font-mono" id="slug" name="slug" defaultValue={slug} required />
        </div>
      </div>
      <p className="text-xs text-mist/70">
        Looking for your tagline? It lives in the{" "}
        <Link href="/dashboard/builder" className="text-brand hover:underline">
          Footer section
        </Link>
        , and your colors are in the{" "}
        <Link href="/dashboard/builder?tab=design" className="text-brand hover:underline">
          Design tab
        </Link>
        .
      </p>
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      <button className="btn-primary !py-2 text-sm" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
