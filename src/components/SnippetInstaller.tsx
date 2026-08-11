"use client";

import { useState } from "react";
import { INSTALLERS, type Installer } from "@/lib/installers";
import { SnippetChecker } from "@/components/SnippetChecker";

/**
 * Guided install: pick how you manage your site, get that platform's exact
 * click-path, copy one line, then have us verify it for you.
 *
 * The picker exists because "paste this before </body>" is only actionable if
 * you know where your HTML lives — which most creators don't. Each path also
 * says honestly whether it needs a developer, so nobody discovers that after
 * a failed paste.
 */
export function SnippetInstaller({
  snippet,
  siteUrl,
  showChecker,
}: {
  snippet: string;
  siteUrl?: string;
  /** Hidden once the snippet has been seen — there's nothing left to check. */
  showChecker: boolean;
}) {
  const [picked, setPicked] = useState<Installer | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <p className="text-sm text-mist">
        {picked
          ? "Copy the line, then follow the steps for your platform."
          : "First — how do you manage your website? We'll give you the exact steps."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {INSTALLERS.map((i) => {
          const active = picked?.id === i.id;
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => setPicked(active ? null : i)}
              className={`cursor-pointer rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                active
                  ? "border-brand bg-brand/10 text-snow"
                  : "border-edge bg-panel2 text-mist hover:border-brand/60 hover:text-snow"
              }`}
            >
              {i.name}
              {i.blurb && <span className="block text-[11px] font-normal text-mist/70">{i.blurb}</span>}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-4 rounded-xl border border-edge bg-panel2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold">{picked.name}</p>
            <button type="button" className="btn-primary !py-1.5 !px-3 text-xs" onClick={copy}>
              {copied ? "Copied" : "Copy the line"}
            </button>
          </div>

          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink/60 p-3 font-mono text-[11px] leading-relaxed text-snow">
            {snippet}
          </pre>

          {picked.needsRebuild && (
            <p className="mt-3 rounded-lg border border-warn/40 bg-warn/5 px-3 py-2 text-xs text-warn">
              Heads up: your site is built before it&apos;s published, so this needs a deploy to take effect — and
              editing the published file won&apos;t survive your next build.
            </p>
          )}

          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-mist">
            {picked.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>

          {picked.note && <p className="mt-3 text-xs leading-relaxed text-mist/80">{picked.note}</p>}

          {picked.needsRebuild && (
            <SendToDeveloper snippet={snippet} />
          )}
        </div>
      )}

      {showChecker && <SnippetChecker initialUrl={siteUrl} />}
    </div>
  );
}

/**
 * Custom builds usually mean someone else does the deploying. Hand the
 * creator something they can forward verbatim instead of relaying it.
 */
function SendToDeveloper({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Hi — could you add this one line to our site's index.html, just before the closing </body> tag, then build and deploy as usual?

${snippet}

It's a script tag from Ensemble that lets me edit the site's text and images from a dashboard. It doesn't change the layout or styling, and it only reads the page. Nothing else needs to change.

Thanks!`;

  return (
    <div className="mt-4 border-t border-edge pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-snow">Someone else manages your site?</p>
        <button
          type="button"
          className="btn-ghost !py-1.5 !px-3 text-xs"
          onClick={async () => {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied" : "Copy a message for them"}
        </button>
      </div>
      <p className="mt-1 text-xs text-mist/70">
        Copies a short, ready-to-send note with the line and what it does.
      </p>
    </div>
  );
}
