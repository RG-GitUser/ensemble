"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Segment-level error boundary.
 *
 * There were no error boundaries anywhere in the app, so any unhandled throw
 * showed a creator's visitors Next's raw "Application error" screen — and
 * toSite carried an unguarded JSON.parse on the public render path, so one
 * corrupt config blob was enough to produce exactly that.
 *
 * `error.message` is generic for Server Component errors in production; the
 * digest is the only thing that ties this screen to a line in the server log,
 * which is why it is shown rather than hidden.
 */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="glow flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="card">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-1 text-sm text-mist">
            That didn&apos;t load. It may be temporary — trying again is usually worth a go.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-mist/70">
              Reference: {error.digest}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => retry()} className="btn-primary !py-2 text-sm">
              Try again
            </button>
            <Link href="/dashboard" className="btn-ghost !py-2 text-sm">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
