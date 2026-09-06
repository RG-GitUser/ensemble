import Link from "next/link";
import { getAuthToken } from "@/lib/db";
import { maskEmail } from "@/lib/mailer";
import { confirmBackupEmail } from "@/lib/actions";

/**
 * Confirm a recovery address.
 *
 * The confirmation happens on POST, behind a button. Spending the token on
 * render — the shape most emailed links have — is wrong for THIS link: what it
 * grants is the ability to change the account's login address and password, so
 * a stranger who received it by typo and clicked out of curiosity, or a mail
 * provider that prefetches links with no human involved, completed a takeover.
 *
 * The page also names the account (masked) so the reader can tell whether the
 * thing they are being asked to confirm is anything to do with them.
 */
export default async function VerifyBackupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { token } = await params;
  const { state } = await searchParams;
  // Once spent, the token no longer resolves — the query param carries the
  // outcome across the redirect.
  const pending = state ? null : getAuthToken(token, "verify_backup");

  return (
    <div className="glow flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-lg font-bold tracking-tight">
          En<span className="bg-gradient-to-r from-brand to-brand2 bg-clip-text text-transparent">semble</span>
        </Link>
        <div className="card">
          {state === "done" ? (
            <>
              <h1 className="text-2xl font-bold">Recovery address confirmed</h1>
              <p className="mt-1 text-sm text-mist">
                This address can now get you back in if you ever lose track of the address you log in with.
              </p>
            </>
          ) : pending ? (
            <>
              <h1 className="text-2xl font-bold">Confirm this recovery address</h1>
              <p className="mt-1 text-sm text-mist">
                <span className="font-semibold text-snow">{pending.payload}</span> was added as the recovery address for
                the Ensemble account <span className="font-semibold text-snow">{maskEmail(pending.user.email)}</span>.
              </p>
              <p className="mt-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-warn">
                Confirming means this mailbox can change that account&apos;s login address and password. If that account
                isn&apos;t yours, close this page — nothing happens unless you press the button.
              </p>
              <form action={confirmBackupEmail} className="mt-6">
                <input type="hidden" name="token" value={token} />
                <button className="btn-primary block w-full text-center">Confirm this address</button>
              </form>
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
          <Link href="/dashboard/settings" className="btn-ghost mt-6 block w-full text-center">
            Back to settings
          </Link>
        </div>
      </div>
    </div>
  );
}
