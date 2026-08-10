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
  /**
   * A-record value (server IP), or null when the server hasn't been told its
   * own address. Null must stay null — the previous placeholder string told
   * people to create an A record pointing at the words "our server IP".
   */
  aRecord: string | null;
  /** CNAME target, same rule as aRecord. */
  cnameTarget: string | null;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setCustomDomainAction, {});
  const dnsReady = !!aRecord && !!cnameTarget;

  const card = (
    <div className="card space-y-4">
      <div>
        <h2 className="font-bold">Custom domain</h2>
        <p className="mt-1 text-sm text-mist">
          Buy a domain anywhere (Namecheap, GoDaddy, Cloudflare…), point it at Ensemble, and your page lives there —
          your visitors never see an Ensemble URL.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Explainer q="What's my domain?">
            It&apos;s the address people type to reach you, like <span className="font-mono">janedoe.com</span>. You buy
            one from a registrar (Namecheap, GoDaddy, Cloudflare) and it&apos;s yours to point wherever you like. You
            don&apos;t need one: without it your page lives at our address. A domain just makes it yours.
          </Explainer>
          <Explainer q="What's DNS?">
            DNS is the internet&apos;s phone book. It&apos;s what turns your domain into the actual computer that serves
            your page. Adding a &ldquo;record&rdquo; below is you updating your entry in that book so it points at us. You
            do it where you bought the domain, usually under a menu called{" "}
            <span className="font-semibold text-snow">DNS</span> or{" "}
            <span className="font-semibold text-snow">Advanced DNS</span>. It can take up to an hour to spread worldwide.
            That&apos;s normal, and nothing is broken while you wait.
          </Explainer>
        </div>
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

      {dnsReady ? (
        <div className="space-y-1.5 rounded-xl bg-panel2 px-4 py-3 text-xs text-mist">
          <p className="font-semibold text-snow">At your domain registrar, add one of these DNS records:</p>
          <p>
            Using your main domain (<span className="font-mono">janedoe.com</span>): add an{" "}
            <span className="font-mono text-snow">A</span> record pointing to{" "}
            <span className="font-mono text-snow">{aRecord}</span>
          </p>
          <p>
            Using www or a subdomain (<span className="font-mono">shop.janedoe.com</span>): add a{" "}
            <span className="font-mono text-snow">CNAME</span> record pointing to{" "}
            <span className="font-mono text-snow">{cnameTarget}</span>
          </p>
          <p className="pt-1">
            Add whichever one matches the address you typed above — you don&apos;t need both. Most registrars want just
            the first part in the &ldquo;Host&rdquo; box (<span className="font-mono">shop</span>, not{" "}
            <span className="font-mono">shop.janedoe.com</span>), or <span className="font-mono">@</span> for your main
            domain.
          </p>
          <p>
            Visitors on the www / non-www twin are covered automatically, and the padlock (HTTPS) is set up for you the
            first time someone visits.
          </p>
        </div>
      ) : (
        // Better to say nothing than to invent DNS values. The old fallback
        // rendered literally as "point an A record at our server IP".
        <div className="rounded-xl border border-warn/40 bg-warn/5 px-4 py-3 text-xs">
          <p className="font-semibold text-warn">Domain setup isn&apos;t available right now</p>
          <p className="mt-1 text-mist">
            We can&apos;t show you the DNS details at the moment, so please don&apos;t change anything at your registrar
            yet — you&apos;d be pointing your domain at the wrong place. Get in touch and we&apos;ll sort it out.
          </p>
        </div>
      )}
    </div>
  );

  return allowed ? card : <LockedOverlay plan="Pro">{card}</LockedOverlay>;
}

/**
 * A jargon term with a plain-English answer, collapsed until asked for.
 * Native <details> so it works without JS and stays keyboard-accessible.
 */
function Explainer({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group w-full rounded-xl border border-edge bg-panel2/60 px-3 py-2 open:bg-panel2">
      {/* list-none covers Chrome/Firefox; Safari needs the webkit marker hidden too. */}
      <summary className="cursor-pointer list-none text-xs font-semibold text-brand [&::-webkit-details-marker]:hidden">
        {q}
        <span className="ml-1.5 inline-block text-mist transition group-open:rotate-90">›</span>
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-mist">{children}</p>
    </details>
  );
}
