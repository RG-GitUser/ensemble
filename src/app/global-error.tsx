"use client";

/**
 * Root-layout error boundary.
 *
 * Replaces the whole document when the root layout itself throws, so it has to
 * carry its own <html> and <body>. It renders outside globals.css, and the
 * app's theme is applied by a boot script in the root layout that never runs
 * here — so this deliberately uses inline styles and follows the OS colour
 * scheme rather than looking half-themed.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          colorScheme: "light dark",
          padding: "2rem",
        }}
      >
        <title>Something went wrong — Ensemble</title>
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 1rem", lineHeight: 1.6, opacity: 0.8 }}>
            Ensemble hit an error it couldn&apos;t recover from on this page.
          </p>
          {error.digest && (
            <p style={{ margin: "0 0 1rem", fontFamily: "ui-monospace, monospace", fontSize: "0.8rem", opacity: 0.6 }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={() => retry()}
            style={{
              font: "inherit",
              padding: "0.6rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid currentColor",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
