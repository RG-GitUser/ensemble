"use client";

import { useActionState } from "react";
import { removeBackupEmail, setBackupEmail, type FormState } from "@/lib/actions";

/**
 * The account's recovery address.
 *
 * Shown as three states rather than one form: confirmed, awaiting a
 * confirmation that has been sent, and not set. The middle one matters — an
 * address sitting unconfirmed is not a way back in, and a card that showed it
 * as though it were would be worse than showing nothing.
 */
export function BackupEmailCard({
  backupEmail,
  verified,
  mailOn,
}: {
  backupEmail: string;
  verified: boolean;
  mailOn: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(setBackupEmail, {});

  return (
    <div className="card">
      <h2 className="font-bold">Recovery address</h2>
      <p className="mt-1 text-sm text-mist">
        A second inbox that can get you back in if you forget which address you log in with. It never receives your
        newsletters or anything else — only account recovery.
      </p>

      {verified && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-good/15 px-2.5 py-1 text-xs font-semibold text-good">Confirmed</span>
          <span className="font-semibold text-snow">{backupEmail}</span>
        </p>
      )}

      {!mailOn && (
        <p className="mt-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-warn">
          Email sending isn&apos;t switched on for this server, so an address can&apos;t be confirmed yet.
        </p>
      )}

      {state.ok ? (
        <p className="mt-4 rounded-xl border border-good/40 bg-good/10 px-4 py-2.5 text-sm text-snow">{state.message}</p>
      ) : (
        <form action={formAction} className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor="backupEmail">
              {verified ? "Replace it with" : "Add an address"}
            </label>
            <input
              className="field"
              id="backupEmail"
              name="backupEmail"
              type="email"
              autoComplete="email"
              placeholder="your-other@example.com"
              required
            />
          </div>
          {state.error && (
            <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary !py-2 text-sm" disabled={pending || !mailOn}>
              {pending ? "Sending…" : verified ? "Send confirmation" : "Confirm this address"}
            </button>
            {verified && (
              <button formAction={removeBackupEmail} className="btn-ghost !py-2 text-sm !text-brand2" formNoValidate>
                Remove
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
