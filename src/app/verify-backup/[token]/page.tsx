import Link from "next/link";
import { consumeBackupVerification, getAuthToken } from "@/lib/db";

/**
 * Confirm a recovery address.
 *
 * Spends the token on render. That makes this a GET with a side effect, which
 * is the shape every emailed confirmation link has: the alternative is a page
 * with a button, and a link that needs a second click gets abandoned. The
 * token is single-use, so a mail scanner prefetching it costs the creator a
 * re-send rather than anything worse.
 */
export default async function VerifyBackupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const pending = getAuthToken(token, "verify_backup");
  const address = pending?.payload ?? "";
  const confirmed = pending ? consumeBackupVerification(token) : false;

  return (
    <div className="glow flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-lg font-bold tracking-tight">
          En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
        </Link>
        <div className="card">
          {confirmed ? (
            <>
              <h1 className="text-2xl font-bold">Recovery address confirmed</h1>
              <p className="mt-1 text-sm text-mist">
                <span className="font-semibold text-snow">{address}</span> can now get you back in if you ever lose
                track of the address you log in with.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">That link has expired</h1>
              <p className="mt-1 text-sm text-mist">
                Confirmation links work once and last 45 minutes. Add the address again from Settings and we&apos;ll
                send a fresh one.
              </p>
            </>
          )}
          <Link href="/dashboard/settings" className="btn-primary mt-6 block w-full text-center">
            Back to settings
          </Link>
        </div>
      </div>
    </div>
  );
}
