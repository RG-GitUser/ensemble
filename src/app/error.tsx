"use client";

/**
 * Route-level error boundary.
 *
 * Without one, any throw below a route segment reaches Next's built-in screen —
 * "Application error: a server-side exception has occurred" — which is what a
 * creator's visitors would have seen. Client component by requirement: this is
 * the one place React needs a boundary that can re-render on the client.
 */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-mist">
        This page didn&apos;t load. Trying again usually works — if it keeps happening, the problem is on our side.
      </p>
      <button onClick={reset} className="btn-primary mt-6 !py-2 text-sm">
        Try again
      </button>
    </main>
  );
}
