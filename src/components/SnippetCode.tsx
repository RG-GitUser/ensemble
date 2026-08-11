"use client";

import { useState } from "react";

/**
 * The line, shown as code rather than as a wall of grey text.
 *
 * Built from its parts instead of parsing a string: we generate the snippet,
 * so its shape is known and the token — the one piece that differs per
 * creator, and the one people mis-copy — can be picked out deliberately.
 */
export function SnippetCode({ origin, token }: { origin: string; token: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${origin}/connect.js" data-site="${token}" async></script>`;

  return (
    <div className="overflow-hidden rounded-xl border border-brand/30 bg-ink/70">
      <div className="flex items-center justify-between gap-3 border-b border-brand/20 bg-brand/10 px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wider text-brand">Your line</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="btn-primary !py-1.5 !px-3 text-xs"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-relaxed">
        <code>
          <Punct>{"<"}</Punct>
          <span className="text-brand2">script</span>{" "}
          <Attr>src</Attr>
          <Punct>=</Punct>
          <Str>&quot;{origin}/connect.js&quot;</Str>{" "}
          <Attr>data-site</Attr>
          <Punct>=</Punct>
          <span className="rounded bg-good/15 px-1 text-good">&quot;{token}&quot;</span>{" "}
          <Attr>async</Attr>
          <Punct>{"></"}</Punct>
          <span className="text-brand2">script</span>
          <Punct>{">"}</Punct>
        </code>
      </pre>

      <p className="border-t border-edge/60 px-4 py-2 text-[11px] text-mist">
        The <span className="text-good">green part</span> is your private pairing key — it&apos;s what tells us which
        page is yours. Copy the whole line exactly; don&apos;t retype it.
      </p>
    </div>
  );
}

const Attr = ({ children }: { children: React.ReactNode }) => <span className="text-brand">{children}</span>;
const Str = ({ children }: { children: React.ReactNode }) => <span className="text-snow">{children}</span>;
const Punct = ({ children }: { children: React.ReactNode }) => <span className="text-mist/60">{children}</span>;
