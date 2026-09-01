import "server-only";

/**
 * Outbound email for creator newsletters. Activates when RESEND_API_KEY is
 * set; without it the app runs in preview mode and the Audience tab says so
 * — the same switch-on-when-configured pattern billing and the live relay
 * use.
 *
 * Env:
 *   RESEND_API_KEY  re_... (resend.com — domain must be verified there)
 *   MAIL_FROM       sending address, e.g. "Ensemble <news@ensemble.it.com>"
 *
 * Mail goes out from the PLATFORM's address with the creator's name as the
 * display name and their account email as reply-to: recipients can reply to
 * the creator, while SPF/DKIM stay aligned with a domain we actually control.
 */

const BATCH_SIZE = 100; // Resend's /emails/batch ceiling per request.

export function mailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** Bare address out of MAIL_FROM, whether it's "Name <a@b>" or just a@b. */
function fromAddress(): string {
  const raw = process.env.MAIL_FROM || "Ensemble <onboarding@resend.dev>";
  const m = raw.match(/<([^>]+)>/);
  return m ? m[1] : raw.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface NewsletterRecipient {
  email: string;
  /** Absolute unsubscribe URL, unique to this address. */
  unsubUrl: string;
}

/**
 * Send one newsletter to every recipient, one personalised email each (the
 * unsubscribe link differs per address). Batches of 100 per API call; a
 * failed batch fails those recipients and the rest still go out, so the
 * count that comes back is honest.
 */
export async function sendNewsletter(opts: {
  /** Creator's public name — becomes the From display name. */
  fromName: string;
  /** Creator's account email — replies go here, not to the platform. */
  replyTo: string;
  subject: string;
  /** Plain text; blank lines separate paragraphs. */
  body: string;
  recipients: NewsletterRecipient[];
}): Promise<{ sent: number; failed: number }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, failed: opts.recipients.length };

  // Display name in an address header: keep it to characters that can't
  // terminate or fake the header structure.
  const safeName = opts.fromName.replace(/[<>"\r\n]/g, "").trim() || "Ensemble";
  const from = `${safeName} <${fromAddress()}>`;

  const paragraphs = escapeHtml(opts.body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 1em; line-height:1.6;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < opts.recipients.length; i += BATCH_SIZE) {
    const batch = opts.recipients.slice(i, i + BATCH_SIZE).map((r) => ({
      from,
      to: [r.email],
      reply_to: opts.replyTo,
      subject: opts.subject,
      text: `${opts.body}\n\n—\nUnsubscribe: ${r.unsubUrl}`,
      html:
        `<div style="max-width:36em; margin:0 auto; font-family:system-ui,-apple-system,sans-serif; color:#1a1a1a;">` +
        paragraphs +
        `<p style="margin:2em 0 0; font-size:12px; color:#888;">` +
        `You're getting this because you subscribed on ${escapeHtml(safeName)}'s page · ` +
        `<a href="${escapeHtml(r.unsubUrl)}" style="color:#888;">Unsubscribe</a></p></div>`,
    }));

    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
      else failed += batch.length;
    } catch {
      failed += batch.length;
    }
  }
  return { sent, failed };
}
