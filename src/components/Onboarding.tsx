"use client";

import { useActionState, useState } from "react";
import { startFromScratch, submitQuote, type FormState } from "@/lib/actions";
import { PLAN_ORDER, PLANS } from "@/lib/plans";
import type { Plan } from "@/lib/types";

export function Onboarding({ initialPath, initialPlan }: { initialPath?: string; initialPlan?: string }) {
  const [path, setPath] = useState<"scratch" | "integrate" | null>(
    initialPath === "integrate" ? "integrate" : initialPlan ? "scratch" : null
  );

  return (
    <div className="w-full max-w-3xl">
      {/* Step 1: choose a path */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setPath("scratch")}
          className={`card text-left transition hover:border-brand/60 ${path === "scratch" ? "border-brand ring-1 ring-brand" : ""}`}
        >
          <div className="text-2xl">🚀</div>
          <h2 className="mt-3 font-bold">Start From Scratch</h2>
          <p className="mt-1 text-sm text-mist">
            We host a new landing page for your bonus content, your story and merch sales. Live today.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setPath("integrate")}
          className={`card text-left transition hover:border-brand2/60 ${path === "integrate" ? "border-brand2 ring-1 ring-brand2" : ""}`}
        >
          <div className="text-2xl">🔌</div>
          <h2 className="mt-3 font-bold">Integrate a Current Website</h2>
          <p className="mt-1 text-sm text-mist">
            We rework your existing platform to connect to the SocialConstruct dashboard. Starts with a personal quote.
          </p>
        </button>
      </div>

      {path === "scratch" && <PlanPicker initialPlan={initialPlan} />}
      {path === "integrate" && <QuoteForm />}
    </div>
  );
}

function PlanPicker({ initialPlan }: { initialPlan?: string }) {
  const [plan, setPlan] = useState<Plan>(
    initialPlan && initialPlan in PLANS ? (initialPlan as Plan) : "pro"
  );

  return (
    <form action={startFromScratch} className="mt-8">
      <h2 className="text-xl font-bold">Pick your package</h2>
      <p className="mt-1 text-sm text-mist">You can upgrade or downgrade any time from Settings.</p>
      <input type="hidden" name="plan" value={plan} />
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const selected = plan === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPlan(id)}
              className={`card !p-5 text-left transition hover:border-brand/60 ${selected ? "border-brand ring-1 ring-brand" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">{p.name}</span>
                <span className={`h-4 w-4 rounded-full border ${selected ? "border-brand bg-brand" : "border-edge"}`} />
              </div>
              <div className="mt-1.5 text-2xl font-extrabold">
                ${p.price}<span className="text-sm font-normal text-mist">/mo</span>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs text-mist">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      <button className="btn-primary mt-6 w-full sm:w-auto">
        Continue with {PLANS[plan].name} — ${PLANS[plan].price}/mo
      </button>
    </form>
  );
}

function QuoteForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitQuote, {});
  return (
    <form action={formAction} className="card mt-8 space-y-4">
      <div>
        <h2 className="text-xl font-bold">Tell us about your website</h2>
        <p className="mt-1 text-sm text-mist">
          Integrations are custom work, so pricing is quoted per project. Share the details and we&apos;ll reach out
          with an actual quote.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="websiteUrl">Current website URL</label>
        <input className="field" id="websiteUrl" name="websiteUrl" type="url" placeholder="https://yoursite.com" required />
      </div>
      <div>
        <label className="label" htmlFor="details">What does your site run on, and what do you want it to do?</label>
        <textarea
          className="field min-h-28"
          id="details"
          name="details"
          placeholder="e.g. WordPress store with 2k members — want merch, memberships and a community chat connected to one dashboard."
        />
      </div>
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Sending…" : "Request my quote"}
      </button>
    </form>
  );
}
