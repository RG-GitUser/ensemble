"use client";

import { useActionState } from "react";
import { login, signup, type FormState } from "@/lib/actions";

export function AuthForm({
  mode,
  intentPlan,
  intentPath,
}: {
  mode: "signup" | "login";
  intentPlan?: string;
  intentPath?: string;
}) {
  const action = mode === "signup" ? signup : login;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {mode === "signup" && (
        <>
          <input type="hidden" name="intentPlan" value={intentPlan ?? ""} />
          <input type="hidden" name="intentPath" value={intentPath ?? ""} />
          <div>
            <label className="label" htmlFor="name">Your name</label>
            <input className="field" id="name" name="name" placeholder="Riley Gaffney" required />
          </div>
          <div>
            <label className="label" htmlFor="businessName">Business / creator name</label>
            <input className="field" id="businessName" name="businessName" placeholder="Riley Makes Things" required />
          </div>
        </>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="field" id="email" name="email" type="email" placeholder="you@example.com" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input
          className="field"
          id="password"
          name="password"
          type="password"
          placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
          required
        />
      </div>
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "One moment…" : mode === "signup" ? "Create my account" : "Log in"}
      </button>
    </form>
  );
}
