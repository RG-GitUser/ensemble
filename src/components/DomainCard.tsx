"use client";

import { useActionState } from "react";
import { removeCustomDomainAction, setCustomDomainAction, type FormState } from "@/lib/actions";
import { LockedOverlay } from "@/components/LockedOverlay";

export function DomainCard({
  hostname,
  lastSeen,
  allowed,
  aRecord,
  cnameTarget,
}: {
  hostname: string;
  lastSeen: string | null;
  allowed: boolean;
  /** A-record value (server IP) shown in the DNS instructions. */
  aRecord: string;
  /** CNAME target shown in the DNS instructions. */
  cnameTarget: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setCustomDomainAction, {});

  const card = (
    <div className="card space-y-4">
      <div>
        <h2 className="font-bold">Custom domain</h2>
        <p className="mt-1 text-sm text-mist">
          Buy a domain anywhere (Namecheap, GoDaddy, Cloudflare…), point it at Ensemble, and your page lives there —
          your visitors never see an Ensemble URL.
        </p>
      </div>

      {hostname && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-panel2 px-4 py-3">
          <a
            href={`https://${hostname}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm text-brand hover:underline"
          >
            {hostname} ↗
          </a>
          <span className={`text-xs font-semibold ${lastSeen ? "text-good" : "text-warn"}`}>
            {lastSeen
              ? `● Connected — last visit ${lastSeen.slice(0, 16).replace("T", " ")} UTC`
              : "● Waiting for DNS — add the records below, then open your domain"}
          </span>
        </div>
      )}

      <form action={formAction} className="flex flex-wrap gap-2">
        <input
          className="field !w-auto min-w-52 flex-1 font-mono"
          name="hostname"
          placeholder="janedoe.com"
          defaultValue={hostname}
          required
        />
        <button className="btn-primary !py-2 text-sm" disabled={pending}>
          {pending ? "Saving…" : hostname ? "Change domain" : "Connect domain"}
        </button>
        {hostname && (
          <button formAction={removeCustomDomainAction} className="btn-ghost !py-2 text-sm !text-brand2">
            Remove
          </button>
        )}
      </form>
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}

      <div className="space-y-1.5 rounded-xl bg-panel2 px-4 py-3 text-xs text-mist">
        <p className="font-semibold text-snow">At your domain registrar, add one of these DNS records:</p>
        <p>
          Root domain (janedoe.com): an <span className="font-mono text-snow">A</span> record →{" "}
          <span className="font-mono text-snow">{aRecord}</span>
        </p>
        <p>
          www / subdomain: a <span className="font-mono text-snow">CNAME</span> record →{" "}
          <span className="font-mono text-snow">{cnameTarget}</span>
        </p>
        <p className="pt-1">
          Whichever matches the address you entered — visitors on the www / non-www twin are covered automatically.
          HTTPS is issued for you on the first visit, and DNS changes can take up to an hour to spread.
        </p>
      </div>
    </div>
  );

  return allowed ? card : <LockedOverlay plan="Pro">{card}</LockedOverlay>;
}
