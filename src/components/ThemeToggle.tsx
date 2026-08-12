"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

/** Kept in sync with the inline boot script in layout.tsx. */
const KEY = "ensemble-theme";

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private browsing / storage disabled — the toggle still works for this
    // page view, it just won't be remembered.
  }
}

/**
 * Light/dark switch for the platform UI.
 *
 * Reads the theme the boot script already applied rather than assuming a
 * default, so the button never renders showing the wrong state. Creator
 * pages don't participate — see the note in globals.css.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as Theme) || "dark";
    setTheme(current);
    setReady(true);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        // Read the live attribute rather than React state: state can lag the
        // DOM between renders, and the boot script (or another tab) may have
        // set it without React ever knowing. The <html> element is the one
        // source of truth for the current theme.
        const current = (document.documentElement.dataset.theme as Theme) || "dark";
        const flipped: Theme = current === "dark" ? "light" : "dark";
        apply(flipped);
        setTheme(flipped);
      }}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-edge text-mist transition hover:border-brand/60 hover:text-snow ${className}`}
    >
      {/* Hidden until mounted so a server-rendered icon can't contradict the
          theme the boot script picked. The box still occupies its space, so
          nothing shifts when it appears. */}
      <span aria-hidden className={ready ? "" : "invisible"}>
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
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
