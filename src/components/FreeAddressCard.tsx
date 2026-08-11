"use client";

import { useActionState, useState } from "react";
import { togglePublish, updateSettings, type FormState } from "@/lib/actions";

/**
 * The no-domain-needed option: every page already has a free address on
 * Ensemble. Sits above the custom-domain checklist so nobody thinks buying a
 * domain is required to get online.
 *
 * Slug edits reuse updateSettings, which also owns the tagline — the hidden
 * field carries the current tagline through unchanged.
 */
export function FreeAddressCard({
  slug,
  tagline,
  origin,
  published,
  billingReady,
}: {
  slug: string;
  tagline: string;
  /** Public base URL of the platform, e.g. https://ensemble.it.com */
  origin: string;
  published: boolean;
  billingReady: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateSettings, {});
  const [draft, setDraft] = useState(slug);
  const [copied, setCopied] = useState(false);
  const url = `${origin}/s/${slug}`;
  const pretty = url.replace(/^https?:\/\//, "");

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">No domain? Use ours — free</h2>
          <p className="mt-1 text-sm text-mist">
            Don&apos;t have a domain? Don&apos;t want to buy one? You don&apos;t need to. Every Ensemble page comes
            with its own address, included in your plan. Pick your name below and you&apos;re online — no registrar,
            no DNS, nothing to renew.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            published ? "bg-good/15 text-good" : "bg-warn/15 text-warn"
          }`}
        >
          {published ? "● Live" : "● Draft"}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-panel2 px-4 py-3">
        <a href={url} target="_blank" rel="noreferrer" className="break-all font-mono text-sm text-brand hover:underline">
          {pretty} ↗
        </a>
        <button
          type="button"
          className="btn-ghost !py-1.5 !px-3 text-xs"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <form action={formAction} className="space-y-2">
        <label className="label" htmlFor="free-slug">Choose your address</label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-mist">{origin.replace(/^https?:\/\//, "")}/s/</span>
          <input
            id="free-slug"
            name="slug"
            className="field !w-auto min-w-40 flex-1 font-mono"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            required
          />
          <input type="hidden" name="tagline" value={tagline} />
          <button className="btn-primary !py-2 text-sm" disabled={pending || draft === slug}>
            {pending ? "Saving…" : "Save address"}
          </button>
        </div>
        <p className="text-xs text-mist/70">
          Letters, numbers and dashes. Changing this changes your link — anywhere you&apos;ve already shared the old
          one will stop working.
        </p>
        {state.error && (
          <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">
            {state.error}
          </p>
        )}
      </form>

      {!published && (
        <div className="flex flex-wrap items-center gap-3 border-t border-edge pt-4">
          {billingReady ? (
            <>
              <form action={togglePublish}>
                <button className="btn-primary !py-2 text-sm">Publish my page</button>
              </form>
              <span className="text-xs text-mist">
                Until you press this, your address shows a &ldquo;not live yet&rdquo; screen to everyone but you.
              </span>
            </>
          ) : (
            <span className="text-xs text-warn">
              Finish checkout on the Overview page and this address goes live the moment you publish.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
