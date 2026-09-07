"use client";

import { useActionState } from "react";
import { sendNewsletterAction, type FormState } from "@/lib/actions";
import { ScheduleField } from "@/components/ScheduleField";

/**
 * The Audience tab's "write to everyone" form.
 *
 * Deliberately small: subject, words, send. Formatting is paragraphs only —
 * a creator's update reads better as plain writing than as a half-configured
 * template, and it keeps the composer from becoming a page builder.
 */
export function NewsletterComposer({
  recipients,
  mailReady,
  fromName,
  zone,
}: {
  /** How many subscribers the send will reach right now. */
  recipients: number;
  /** Whether the server has an email provider configured at all. */
  mailReady: boolean;
  /** The display name recipients will see it from. */
  fromName: string;
  /** IANA zone the creator picks send times in. */
  zone: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(sendNewsletterAction, {});
  const disabled = pending || !mailReady || recipients === 0;

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input className="field" name="subject" placeholder="Subject" maxLength={150} required />
      <textarea
        className="field min-h-36"
        name="body"
        placeholder="What's new? Blank lines make paragraphs — replies come straight to your inbox."
        maxLength={10000}
        required
      />
      <ScheduleField zone={zone} verb="Send" />
      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      {/* The action says what actually happened - "Scheduled for …" or how many
          it reached. The old fixed string told a creator who scheduled a send
          for next week that it was already on its way. */}
      {state.ok && (
        <p className="rounded-xl border border-good/40 bg-good/10 px-4 py-2.5 text-sm text-good">
          {state.message ?? "Sent — it's on its way to your subscribers."}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-mist/70">
          From <span className="text-mist">{fromName}</span> to {recipients} subscriber{recipients === 1 ? "" : "s"} —
          every email carries its own unsubscribe link.
        </p>
        <button className="btn-primary !py-2 text-sm" disabled={disabled}>
          {pending ? "Sending…" : "Send newsletter"}
        </button>
      </div>
    </form>
  );
}
