"use client";

import { useActionState, useState } from "react";
import {
  removeCustomDomainAction,
  setCustomDomainAction,
  togglePublish,
  type FormState,
} from "@/lib/actions";
import { LockedOverlay } from "@/components/LockedOverlay";

/**
 * The custom-domain journey as a numbered checklist. Every step shows its
 * live status, and the flow makes one promise explicit: the domain cannot go
 * live by accident — it only serves the page once the DNS check has passed
 * AND the page is published. Until then visitors see a "not live yet" screen.
 *
 * Enforcement lives server-side (PublicSite refuses drafts, /domain/[host]
 * refuses plans without the feature); this component is the map of it.
 */
export function DomainSetup({
  hostname,
  lastSeen,
  published,
  billingReady,
  allowed,
  aRecord,
  cnameTarget,
}: {
  hostname: string;
  lastSeen: string | null;
  published: boolean;
  /** False when billing is configured but this site has no active subscription. */
  billingReady: boolean;
  allowed: boolean;
  /** DNS values from env; null means unset — never invent placeholders. */
  aRecord: string | null;
  cnameTarget: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setCustomDomainAction, {});

  const hasDomain = !!hostname;
  const dnsSeen = !!lastSeen;
  const live = hasDomain && dnsSeen && published;
  const dnsReady = !!aRecord && !!cnameTarget;
  const doneCount = [hasDomain, hasDomain, dnsSeen, dnsSeen && published].filter(Boolean).length;

  // An apex domain (janedoe.com) needs an A record; anything with a
  // subdomain (www., shop.) needs a CNAME. Showing only the record that
  // matches what they typed keeps the step to a single action.
  const isApex = hostname.split(".").length === 2;

  const card = (
    <div id="domain" className="card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Your own domain</h2>
          <p className="mt-1 text-sm text-mist">
            Serve this page on a domain you own — no Ensemble address anywhere.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            live ? "bg-good/15 text-good" : "bg-warn/15 text-warn"
          }`}
        >
          {live ? `● Live at ${hostname}` : `● Not live yet — ${doneCount} of 4 steps done`}
        </span>
      </div>

      {!live && (
        <p className="rounded-xl bg-panel2 px-4 py-2.5 text-xs text-mist">
          Nothing goes live by accident: your domain only starts showing your page after{" "}
          <span className="font-semibold text-snow">every step below is complete</span>. Until then, visitors see a
          simple &ldquo;not live yet&rdquo; screen — so it&apos;s safe to set things up at your own pace.
        </p>
      )}

      <ol className="space-y-4">
        {/* Step 1 — buy */}
        <Step n={1} done={hasDomain} title="Buy a domain (skip if you own one)">
          Grab it from any registrar — Namecheap, Cloudflare and GoDaddy all work. Around $10–15/year. Whatever you
          buy is yours, wherever you point it.
        </Step>

        {/* Step 2 — tell us */}
        <Step n={2} done={hasDomain} title="Tell us your domain">
          <form action={formAction} className="mt-2 flex flex-wrap gap-2">
            <input
              className="field !w-auto min-w-52 flex-1 font-mono"
              name="hostname"
              placeholder="janedoe.com"
              defaultValue={hostname}
              required
            />
            <button className="btn-primary !py-2 text-sm" disabled={pending}>
              {pending ? "Saving…" : hasDomain ? "Change" : "Save"}
            </button>
            {hasDomain && (
              <button formAction={removeCustomDomainAction} className="btn-ghost !py-2 text-sm !text-brand2">
                Remove
              </button>
            )}
          </form>
          {state.error && (
            <p className="mt-2 rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">
              {state.error}
            </p>
          )}
        </Step>

        {/* Step 3 — DNS */}
        <Step
          n={3}
          done={dnsSeen}
          title="Point it at Ensemble (one DNS record)"
          status={hasDomain && !dnsSeen ? "Waiting for your record to reach us — checks run automatically" : undefined}
        >
          {!hasDomain ? (
            <>Complete step 2 first — we&apos;ll show you the exact record to add.</>
          ) : !dnsReady ? (
            <span className="text-warn">
              We can&apos;t show DNS details right now, so don&apos;t change anything at your registrar yet — contact
              us and we&apos;ll sort it out.
            </span>
          ) : dnsSeen ? (
            <>
              Connected — we first heard from <span className="font-mono text-snow">{hostname}</span> at{" "}
              {lastSeen!.slice(0, 16).replace("T", " ")} UTC.
            </>
          ) : (
            <div className="mt-3 space-y-4">
              <p>
                A DNS record is one line in the internet&apos;s address book that says &ldquo;{hostname} lives here.&rdquo;
                You add it where you <span className="font-semibold text-snow">bought</span> the domain, not here.
                It&apos;s the only technical part, and it&apos;s{" "}
                <span className="font-semibold text-snow">one record</span> — we worked out which one you need:
              </p>

              {/* Exactly what to type, laid out the way registrar forms are. */}
              <div className="overflow-x-auto rounded-xl border border-edge bg-panel2">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-edge text-mist/70">
                    <tr>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Host / Name</th>
                      <th className="px-4 py-2 font-medium">Value / Points to</th>
                      <th className="px-4 py-2 font-medium">TTL</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-snow">
                    <tr>
                      <td className="px-4 py-3">{isApex ? "A" : "CNAME"}</td>
                      <td className="px-4 py-3">{isApex ? "@" : hostname.split(".")[0]}</td>
                      <td className="flex items-center gap-2 px-4 py-3">
                        <span className="break-all">{isApex ? aRecord : cnameTarget}</span>
                        <CopyChip value={(isApex ? aRecord : cnameTarget)!} />
                      </td>
                      <td className="px-4 py-3 text-mist">Automatic</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs">
                {isApex ? (
                  <>
                    <span className="font-semibold text-snow">@</span> means &ldquo;the domain itself&rdquo;. Some
                    registrars want the word <span className="font-mono text-snow">@</span>, some want it left blank,
                    and some want <span className="font-mono text-snow">{hostname}</span> — all three mean the same
                    thing.
                  </>
                ) : (
                  <>
                    Enter just <span className="font-mono text-snow">{hostname.split(".")[0]}</span> in the Host box,
                    not the whole <span className="font-mono">{hostname}</span> — the registrar adds the rest.
                  </>
                )}{" "}
                If there&apos;s already a record with the same Type and Host (registrars often ship a parking page),
                edit that one instead of adding a second.
              </p>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-mist/70">Where to find it</p>
                <ul className="mt-1.5 space-y-1 text-xs">
                  <li>
                    <span className="font-semibold text-snow">Namecheap</span> — Domain List → Manage → Advanced DNS →
                    Add New Record
                  </li>
                  <li>
                    <span className="font-semibold text-snow">GoDaddy</span> — My Products → Domain → DNS → Add
                  </li>
                  <li>
                    <span className="font-semibold text-snow">Cloudflare</span> — pick the domain → DNS → Records → Add
                    record{isApex ? " (leave the orange cloud on — it works either way)" : ""}
                  </li>
                  <li>
                    <span className="font-semibold text-snow">Google Domains / Squarespace Domains</span> — DNS → Custom
                    records
                  </li>
                  <li>Anywhere else — look for a menu called DNS, Advanced DNS, Name Servers or Zone Editor.</li>
                </ul>
              </div>

              <div className="rounded-xl bg-panel2 px-4 py-3 text-xs">
                <p className="font-semibold text-snow">Then what?</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                  <li>Save the record at your registrar.</li>
                  <li>
                    Wait a few minutes, then open{" "}
                    <a
                      href={`https://${hostname}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-brand hover:underline"
                    >
                      {hostname} ↗
                    </a>
                    .
                  </li>
                  <li>The first visit that reaches us ticks this step green — refresh this page to see it.</li>
                </ol>
                <p className="mt-2 text-mist">
                  Changes usually appear within 5–30 minutes and can take up to an hour to spread worldwide.{" "}
                  <span className="text-snow">Nothing is broken while you wait</span> — you may see your registrar&apos;s
                  parking page or a security warning in the meantime. HTTPS (the padlock) is issued automatically the
                  first time someone visits, so there is no certificate for you to buy or install.
                </p>
              </div>

              <details className="rounded-xl border border-edge bg-panel2/60 px-3 py-2">
                <summary className="cursor-pointer list-none text-xs font-semibold text-brand [&::-webkit-details-marker]:hidden">
                  It&apos;s been over an hour and it still isn&apos;t working
                  <span className="ml-1.5 inline-block text-mist">›</span>
                </summary>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-mist">
                  <li>
                    <span className="text-snow">Check for a duplicate.</span> An old A, CNAME or parking record with the
                    same Host will win. There should be exactly one.
                  </li>
                  <li>
                    <span className="text-snow">Check your nameservers.</span> If your domain uses a web host&apos;s
                    nameservers, the DNS panel at your registrar is ignored — add the record wherever the nameservers
                    point.
                  </li>
                  <li>
                    <span className="text-snow">Don&apos;t use forwarding.</span> &ldquo;Domain forwarding&rdquo;,
                    &ldquo;URL redirect&rdquo; and &ldquo;web forwarding&rdquo; look similar but won&apos;t work — it has
                    to be a real {isApex ? "A" : "CNAME"} record.
                  </li>
                  <li>
                    <span className="text-snow">Try a private window.</span> Your browser and router cache DNS; a fresh
                    window (or your phone on mobile data) shows the truth sooner.
                  </li>
                  <li>Still stuck? Send us the domain and a screenshot of your DNS page and we&apos;ll read it for you.</li>
                </ul>
              </details>
            </div>
          )}
        </Step>

        {/* Step 4 — publish */}
        <Step n={4} done={dnsSeen && published} title="Go live">
          {published ? (
            dnsSeen ? (
              <>
                Your page is live at{" "}
                <a href={`https://${hostname}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                  {hostname} ↗
                </a>
                . 🎉
              </>
            ) : (
              <>Your page is published — it appears on your domain the moment step 3 connects.</>
            )
          ) : !billingReady ? (
            <span className="text-warn">
              Your subscription needs to be active before you can publish — finish checkout on the Overview page.
            </span>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <form action={togglePublish}>
                <button className="btn-primary !py-2 text-sm">Publish my page</button>
              </form>
              <span className="text-xs text-mist">
                The final switch. {hasDomain && !dnsSeen && "Safe to press now — your domain still waits for step 3."}
              </span>
            </div>
          )}
        </Step>
      </ol>
    </div>
  );

  return allowed ? card : <LockedOverlay plan="Pro">{card}</LockedOverlay>;
}

function Step({
  n,
  done,
  title,
  status,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  status?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-good/20 text-good" : "border border-edge text-mist"
        }`}
        aria-hidden
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {title}
          {status && <span className="ml-2 text-xs font-medium text-warn">{status}</span>}
        </p>
        <div className="mt-0.5 text-sm text-mist">{children}</div>
      </div>
    </li>
  );
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="shrink-0 cursor-pointer rounded-lg border border-edge px-2 py-1 font-sans text-mist transition hover:border-brand/60 hover:text-snow"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      title="Copy this value"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
