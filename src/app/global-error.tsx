"use client";

/**
 * The last resort: a failure in the root layout itself, where error.tsx cannot
 * help because the layout that would wrap it is the thing that broke. Ships its
 * own <html>/<body> and no shared styling, for the same reason.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          background: "#0b0714",
          color: "#f4f2ff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Something went wrong</h1>
        <p style={{ margin: 0, opacity: 0.75, fontSize: "0.9rem" }}>Please try again in a moment.</p>
        <button
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.6rem 1.1rem",
            borderRadius: "0.75rem",
            border: "1px solid #ffffff33",
            background: "transparent",
            color: "inherit",
            font: "inherit",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
