"use client";

import { useState } from "react";
import { INSTALLERS, type Installer } from "@/lib/installers";
import { SnippetChecker } from "@/components/SnippetChecker";
import { SnippetCode } from "@/components/SnippetCode";
import { CheckIcon, CloseIcon } from "@/components/icons";

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
  origin,
  token,
  siteUrl,
  showChecker,
}: {
  /** Public origin the snippet loads from — never the dashboard's own host. */
  origin: string;
  token: string;
  siteUrl?: string;
  /** Hidden once the snippet has been seen — there's nothing left to check. */
  showChecker: boolean;
}) {
  const [picked, setPicked] = useState<Installer | null>(null);
  const snippet = `<script src="${origin}/connect.js" data-site="${token}" async></script>`;

  return (
    <div>
      <p className="text-sm text-mist">
        {picked
          ? "Copy the line, then follow the steps below. It's the same line everywhere — only where it goes changes."
          : "First — how do you manage your website? We'll show you exactly where the line goes."}
      </p>

      {/* Equal-height tiles on a fixed grid: the options read as a set to
          choose from, and a long blurb can't make one tile tower over its
          neighbours the way a flex-wrap row did. */}
      <div className="mt-3 grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {INSTALLERS.map((i) => {
          const active = picked?.id === i.id;
          return (
            <button
              key={i.id}
              type="button"
              aria-pressed={active}
              onClick={() => setPicked(active ? null : i)}
              className={`relative flex cursor-pointer flex-col justify-between gap-2 rounded-xl border p-3 text-left transition ${
                active
                  ? "border-brand bg-brand/10 shadow-sm shadow-brand/10"
                  : "border-edge bg-panel2 hover:border-brand/50 hover:bg-panel2/60"
              }`}
            >
              <span>
                <span className={`block text-sm font-semibold ${active ? "text-snow" : "text-snow/90"}`}>
                  {i.name}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-mist/70">{i.blurb}</span>
              </span>

              {i.tag ? (
                <span
                  className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    i.tag.tone === "good" ? "bg-good/15 text-good" : "bg-warn/15 text-warn"
                  }`}
                >
                  {i.tag.label}
                </span>
              ) : (
                // Keeps every tile the same height whether or not it has a badge.
                <span aria-hidden className="h-[18px]" />
              )}

              {active && (
                <span
                  aria-hidden
                  className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white"
                >
                  <CheckIcon />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-5 space-y-5">
          <SnippetCode origin={origin} token={token} />

          {picked.fileHint && <FileHint hint={picked.fileHint} />}

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-mist/70">
              Where it goes — {picked.name}
            </p>
            <ol className="mt-2.5 space-y-2.5">
              {picked.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[11px] font-bold text-brand"
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-snow/90">{s}</span>
                </li>
              ))}
            </ol>
          </div>

          {picked.note && (
            <p className="rounded-xl border border-edge bg-panel2 px-4 py-3 text-xs leading-relaxed text-mist">
              <span className="font-semibold text-snow">Tip · </span>
              {picked.note}
            </p>
          )}

          {picked.needsRebuild && <SendToDeveloper snippet={snippet} />}
        </div>
      )}

      {showChecker && <SnippetChecker initialUrl={siteUrl} />}
    </div>
  );
}

/**
 * Two near-identically-named files, one of which silently discards the edit.
 * Shown side by side because prose describing the difference demonstrably
 * doesn't land — people edit the built copy, rebuild, and lose the line.
 */
function FileHint({ hint }: { hint: NonNullable<Installer["fileHint"]> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-xl border border-good/40 bg-good/5 px-4 py-3">
        <p className="flex items-center gap-2 font-mono text-sm font-semibold text-good">
          <CheckIcon />
          {hint.right}
        </p>
        <p className="mt-1 text-xs text-mist">{hint.rightWhy}</p>
      </div>
      <div className="rounded-xl border border-brand2/40 bg-brand2/5 px-4 py-3">
        <p className="flex items-center gap-2 font-mono text-sm font-semibold text-brand2">
          <CloseIcon />
          {hint.wrong}
        </p>
        <p className="mt-1 text-xs text-mist">{hint.wrongWhy}</p>
      </div>
    </div>
  );
}

/**
 * Custom builds usually mean someone else does the deploying. Hand the
 * creator something they can forward verbatim instead of relaying it.
 */
function SendToDeveloper({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  const message = `Hi — could you add this one line to our site's source index.html (the one in the project root, next to package.json — NOT dist/index.html, which the build regenerates), just before the closing </body> tag, then build and deploy as usual?

${snippet}

It's a script tag from Ensemble that lets me edit the site's text and images from a dashboard. It doesn't change the layout or styling, and it only reads the page. Nothing else needs to change.

Thanks!`;

  return (
    <div className="rounded-xl border border-edge bg-panel2 px-4 py-3">
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
          {copied ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon /> Copied
            </span>
          ) : (
            "Copy a message for them"
          )}
        </button>
      </div>
      <p className="mt-1 text-xs text-mist/70">
        Copies a short, ready-to-send note with the line, which file it goes in, and what it does.
      </p>
    </div>
  );
}
