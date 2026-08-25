"use client";

import { useEffect, useState } from "react";

/** Shared with the inline boot script in PublicSite.tsx. */
const KEY = "ensemble-site-mode";

type Mode = "light" | "dark";

/**
 * Light/dark switch shown on a creator page that offers the visitor a choice.
 *
 * The server renders the page as `data-site-mode="auto"`, which a
 * prefers-color-scheme rule already resolves without any JavaScript. This
 * only takes over once the visitor makes an explicit choice, writing the
 * attribute the stylesheet keys off and remembering it for next time.
 */
export function SiteModeToggle() {
  const [mode, setMode] = useState<Mode>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".site-root");
    if (!root) return;
    const attr = root.dataset.siteMode;
    // "auto" means nothing has been chosen, so what's on screen is whatever
    // the media query resolved — ask the browser rather than guessing.
    const resolved: Mode =
      attr === "light" || attr === "dark"
        ? attr
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    setMode(resolved);
    setReady(true);
  }, []);

  const next: Mode = mode === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        const root = document.querySelector<HTMLElement>(".site-root");
        if (!root) return;
        root.dataset.siteMode = next;
        setMode(next);
        try {
          localStorage.setItem(KEY, next);
        } catch {
          // Private browsing — the switch still works for this page view.
        }
      }}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className="site-card fixed bottom-4 right-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition hover:opacity-80"
      style={{ background: "var(--site-card)", color: "var(--site-ink)" }}
    >
      <span aria-hidden className={ready ? "" : "invisible"}>
        {mode === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
