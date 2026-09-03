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
      // CRLF stripped rather than trusted to the provider's parser: the
      // subject is creator-supplied and every other address-ish field here is
      // already proven newline-free.
      subject: opts.subject.replace(/[\r\n]+/g, " "),
      // RFC 8058. The mail client's own Unsubscribe button sends a POST to this
      // URL, which is exactly what the route now requires — so the native
      // control keeps working while a link *scanner* following the same URL
      // with a GET only reaches a confirmation page.
      headers: {
        "List-Unsubscribe": `<${r.unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
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
        // Every other outbound call in the codebase carries one; a send that
        // hangs here stalls the whole action and the broadcast is never recorded.
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) sent += batch.length;
      else failed += batch.length;
    } catch {
      failed += batch.length;
    }
  }
  return { sent, failed };
}

/**
 * The address platform mail comes from.
 *
 * Deliberately not MAIL_FROM. That one is the creators' newsletter sender and
 * carries a creator's name as its display name; a password reset is from
 * Ensemble itself and should never look like it came from a creator. Defaults
 * to noreply@ on the platform domain, which is a send-only mailbox — replies
 * to a reset link have nowhere useful to go.
 */
function systemFrom(): string {
  return process.env.AUTH_MAIL_FROM || "Ensemble <noreply@ensemble.it.com>";
}

/**
 * Send one password-reset link.
 *
 * Returns false when mail is not configured or the send fails, and the caller
 * deliberately does not surface which — telling a stranger that an address
 * exists but the mail server is down is still telling them the address exists.
 */
async function sendSystemMail(opts: {
  to: string;
  subject: string;
  lead: string;
  cta?: { label: string; url: string };
  footer: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const text = [opts.lead, opts.cta?.url, opts.footer].filter(Boolean).join("\n\n");
  const button = opts.cta
    ? `<p style="margin:0 0 1.5em;"><a href="${escapeHtml(opts.cta.url)}" style="display:inline-block; ` +
      `background:#8b5cf6; color:#fff; padding:0.75em 1.25em; border-radius:0.5em; text-decoration:none; ` +
      `font-weight:600;">${escapeHtml(opts.cta.label)}</a></p>`
    : "";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: systemFrom(),
        to: [opts.to],
        subject: opts.subject,
        text,
        html:
          `<div style="max-width:36em; margin:0 auto; font-family:system-ui,-apple-system,sans-serif; color:#1a1a1a;">` +
          `<p style="margin:0 0 1em; line-height:1.6;">${escapeHtml(opts.lead)}</p>` +
          button +
          `<p style="margin:0; line-height:1.6; font-size:14px; color:#555;">${escapeHtml(opts.footer)}</p></div>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send one password-reset link.
 *
 * Returns false when mail is not configured or the send fails, and the caller
 * deliberately does not surface which — telling a stranger that an address
 * exists but the mail server is down is still telling them the address exists.
 */
export async function sendPasswordReset(opts: { to: string; url: string; expiresMinutes: number }): Promise<boolean> {
  return sendSystemMail({
    to: opts.to,
    subject: "Reset your Ensemble password",
    lead: "Someone asked to reset the password for your Ensemble account.",
    cta: { label: "Choose a new password", url: opts.url },
    footer:
      `The link works once and expires in ${opts.expiresMinutes} minutes. ` +
      `If this wasn't you, ignore this email — your password stays as it is.`,
  });
}

/** Confirm a recovery address can actually receive mail before trusting it. */
export async function sendBackupVerification(opts: {
  to: string;
  url: string;
  expiresMinutes: number;
}): Promise<boolean> {
  return sendSystemMail({
    to: opts.to,
    subject: "Confirm your Ensemble recovery address",
    lead:
      "This address was added as the recovery address for an Ensemble account. " +
      "Confirm it and it can be used to get back in if the login address is ever forgotten.",
    cta: { label: "Confirm this address", url: opts.url },
    footer:
      `The link works once and expires in ${opts.expiresMinutes} minutes. ` +
      `If you weren't expecting this, ignore it — nothing changes unless the link is opened.`,
  });
}

/** Recovery: a link to set a new login address, sent to the recovery mailbox. */
export async function sendLoginRecovery(opts: { to: string; url: string; expiresMinutes: number }): Promise<boolean> {
  return sendSystemMail({
    to: opts.to,
    subject: "Get back into your Ensemble account",
    lead:
      "This address is the recovery address for an Ensemble account, and someone asked for a way back in. " +
      "The link below sets a new login address and password.",
    cta: { label: "Set a new login address", url: opts.url },
    footer:
      `The link works once and expires in ${opts.expiresMinutes} minutes. ` +
      `If this wasn't you, ignore this email — the account is untouched.`,
  });
}

/**
 * Tell the address being replaced that it is being replaced.
 *
 * Recovery hands whoever controls the backup mailbox a new login address and
 * password, which is exactly the shape of a takeover if that mailbox is not
 * theirs. The old address cannot stop it, but it should never be the last to
 * know, so this goes out after the change lands.
 */
export async function sendLoginChangedNotice(opts: { to: string; newEmail: string }): Promise<boolean> {
  return sendSystemMail({
    to: opts.to,
    subject: "Your Ensemble login address was changed",
    lead:
      `The login address for your Ensemble account was changed to ${opts.newEmail} ` +
      `using the account's recovery address. Every signed-in session was ended.`,
    // Not "reply to this message": systemFrom() is a send-only mailbox, and this
    // is the one email a person whose account has just been taken over gets —
    // sending their reply nowhere is the worst possible moment to do it.
    footer: "If this wasn't you, contact support@ensemble.it.com straight away.",
  });
}
