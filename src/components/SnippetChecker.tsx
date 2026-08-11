"use client";

import { useActionState } from "react";
import { checkWebsiteAction, type CheckState } from "@/lib/actions";

/**
 * One-click "is my snippet working?" — the alternative was telling creators to
 * open devtools and read console output, which is not something most of them
 * can do. Every verdict comes back as a plain-English next action.
 */
export function SnippetChecker({ initialUrl }: { initialUrl?: string }) {
  const [state, formAction, pending] = useActionState<CheckState, FormData>(checkWebsiteAction, {});
  const c = state.check;

  return (
    <div className="mt-4 rounded-xl border border-edge bg-panel2 p-4">
      <p className="text-sm font-semibold">Pasted it? Let&apos;s check it for you.</p>
      <p className="mt-1 text-xs text-mist">
        We&apos;ll look at your page and tell you exactly what to do next — no need to open any developer tools.
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap gap-2">
        <input
          name="url"
          type="text"
          defaultValue={initialUrl}
          placeholder="yourwebsite.com"
          className="field !w-auto min-w-52 flex-1"
          required
        />
        <button className="btn-primary !py-2 text-sm" disabled={pending}>
          {pending ? "Checking…" : "Check my website"}
        </button>
      </form>

      {state.error && (
        <p className="mt-3 rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-xs text-brand2">
          {state.error}
        </p>
      )}

      {c && <Verdict check={c} />}
    </div>
  );
}

function Verdict({ check }: { check: NonNullable<CheckState["check"]> }) {
  const tones = {
    good: "border-good/40 bg-good/5 text-good",
    warn: "border-warn/40 bg-warn/5 text-warn",
    bad: "border-brand2/40 bg-brand2/10 text-brand2",
  };

  let tone: keyof typeof tones = "warn";
  let headline = "";
  let body: React.ReactNode = null;

  if (check.status === "ok") {
    tone = "good";
    headline = "Found it — the snippet is on your website.";
    body = (
      <>
        Now open{" "}
        <a href={check.url} target="_blank" rel="noreferrer" className="underline">
          your site
        </a>{" "}
        once and come back — step 2 ticks itself off within a few seconds.
      </>
    );
  } else if (check.status === "missing") {
    tone = "bad";
    headline = "The snippet isn't on your website yet.";
    body = check.spa ? (
      <>
        Your site is <span className="font-semibold">built before it&apos;s published</span> (React, Vue, Vite,
        Next.js — the page arrives empty and fills itself in). Pasting into the published file isn&apos;t enough:
        add the line to the <span className="font-mono">index.html</span> in your project, then{" "}
        <span className="font-semibold">run your build and upload it again</span>. If someone else manages your
        site, forward them the line — that&apos;s all they need.
      </>
    ) : (
      <>
        We loaded your page and couldn&apos;t find the line anywhere in it. Two usual reasons: it was pasted into a
        normal text or content block (most builders silently strip code from those — use the code-injection box
        listed above), or the change hasn&apos;t been saved and published yet.
      </>
    );
  } else if (check.status === "wrong-origin") {
    tone = "bad";
    headline = "The line on your site points at the wrong address.";
    body = (
      <>
        Yours currently loads <span className="break-all font-mono">{check.foundSrc || "(no src)"}</span>, which
        your visitors&apos; browsers can&apos;t reach. Copy the snippet above again — it&apos;s the correct one — and
        replace the old line.
      </>
    );
  } else if (check.status === "wrong-token") {
    tone = "bad";
    headline = "That snippet belongs to a different key.";
    body = <>Your pairing key was reset since you pasted it. Copy the snippet above again and replace the old line.</>;
  } else {
    tone = "warn";
    headline = "We couldn't load your website from here.";
    body = (
      <>
        That usually means a firewall is blocking us, or the address is wrong — it doesn&apos;t necessarily mean the
        snippet is broken. Double-check the address, and if your site loads fine for you, just open it once and see
        whether step 1 ticks itself off. {check.detail && <span className="opacity-70">({check.detail})</span>}
      </>
    );
  }

  return (
    <div className={`mt-3 rounded-xl border px-4 py-3 text-xs ${tones[tone]}`}>
      <p className="font-semibold">{headline}</p>
      <p className="mt-1 leading-relaxed text-mist">{body}</p>
    </div>
  );
}
