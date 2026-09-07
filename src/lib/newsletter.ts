import "server-only";

import * as store from "./db";
import { mailEnabled, sendNewsletter } from "./mailer";
import { planFor } from "./billing";
import type { Site } from "./types";

/**
 * One newsletter send, for both callers.
 *
 * This lived inline in sendNewsletterAction until scheduling needed the same
 * thing on a timer. Copying it would have meant two places that each have to
 * remember the subtle part below - that the broadcast is recorded whenever ANY
 * mail went out, before deciding what to report - and the scheduled copy is
 * exactly the one nobody would be watching when it drifted.
 */

/** Past this, one send is too big for this server to do in a single pass. */
export const MAX_NEWSLETTER_RECIPIENTS = 5_000;

export interface DeliveryResult {
  ok: boolean;
  sent: number;
  failed: number;
  /** Ready to show a creator, whether it worked or not. */
  message: string;
}

function fail(message: string): DeliveryResult {
  return { ok: false, sent: 0, failed: 0, message };
}

/**
 * Send `subject`/`body` to the site's active subscribers.
 *
 * Every precondition is re-checked at send time rather than trusted from when
 * the caller decided to send: a scheduled newsletter can sit for weeks, and in
 * that time the plan can lapse, the list can empty, or the server's mail
 * configuration can be taken away. A queued send that fires against a
 * downgraded account would be a paid feature delivered for free.
 */
export async function deliverNewsletter(site: Site, subject: string, body: string): Promise<DeliveryResult> {
  if (!planFor(site).newsletter) return fail("Newsletters are an Enterprise feature.");
  if (!mailEnabled()) {
    return fail("Email sending isn't switched on for this server yet — set RESEND_API_KEY and MAIL_FROM (see .env.example).");
  }

  const leads = store.getActiveLeads(site.id);
  if (leads.length === 0) {
    return fail("Nobody to send to yet — the Newsletter section on your page collects subscribers.");
  }
  if (leads.length > MAX_NEWSLETTER_RECIPIENTS) {
    return fail(
      `Your list is over ${MAX_NEWSLETTER_RECIPIENTS.toLocaleString()} addresses, which is past what this server sends in one go. Contact support and we'll raise it.`
    );
  }

  const owner = store.getUserById(site.userId);
  if (!owner) return fail("Account not found.");

  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const { sent, failed } = await sendNewsletter({
    fromName: owner.businessName,
    replyTo: owner.email,
    subject,
    body,
    recipients: leads.map((l) => ({ email: l.email, unsubUrl: `${base}/api/unsubscribe?t=${l.unsubToken}` })),
  });

  // Recorded whenever ANY mail went out, before deciding what to report. A
  // partial failure used to return an error with no broadcast written, so
  // "try again" re-sent to everyone who had already received it and then
  // recorded a second broadcast.
  if (sent > 0) store.recordNewsletterPost(site.id, subject, body, sent);

  if (sent === 0) {
    return { ok: false, sent, failed, message: "Nothing went out — the mail service rejected the send. Check the server's mail configuration." };
  }
  const plural = sent === 1 ? "" : "s";
  return {
    ok: true,
    sent,
    failed,
    message: failed > 0
      ? `Sent to ${sent} subscriber${plural}. ${failed} didn't go through — this send is recorded, so don't resend to the whole list.`
      : `Sent to ${sent} subscriber${plural}.`,
  };
}
