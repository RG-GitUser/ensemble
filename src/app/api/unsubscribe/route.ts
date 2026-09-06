import { unsubscribeLeadByToken } from "@/lib/db";

/**
 * One-click unsubscribe from the link in every newsletter.
 *
 * GET only ASKS. POST is what unsubscribes.
 *
 * This used to mutate on GET, which reads as convenient and is the opposite:
 * corporate mail gateways (Proofpoint, Mimecast, Defender Safe Links) fetch
 * every URL in a message to scan it, so every recipient behind one was
 * unsubscribed before a human read the mail — with nothing in the record to
 * separate that from a real opt-out.
 *
 * The native "Unsubscribe" button in Gmail and Outlook still works, because
 * mailer.ts now sends the RFC 8058 headers and those clients POST. So the
 * one-click path is preserved for the people who actually have one, and the
 * link in the body costs a human one deliberate click.
 */

const HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  // Never cached, never indexed: this URL carries a per-recipient secret.
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

const VALID_TOKEN = /^[0-9a-f]{32}$/;

function page(title: string, body: string, form?: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#0a0812;color:#e8e6f0;font-family:system-ui,-apple-system,sans-serif}main{max-width:26rem;padding:2rem;text-align:center}h1{font-size:1.4rem}p{color:#9b96ad;line-height:1.6}button{font:inherit;font-weight:600;margin-top:1.25rem;padding:.7rem 1.4rem;border:0;border-radius:.6rem;background:#8b5cf6;color:#fff;cursor:pointer}button:hover{opacity:.9}</style>
</head><body><main><h1>${title}</h1><p>${body}</p>${form ?? ""}</main></body></html>`;
}

/** Show the confirmation. Changes nothing — a link scanner lands here safely. */
export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!VALID_TOKEN.test(token)) {
    return new Response(
      page(
        "That link didn't work",
        "It may have been trimmed by your mail app — try copying the whole unsubscribe link from the email."
      ),
      { status: 400, headers: HEADERS }
    );
  }

  // Deliberately does NOT reveal whether the token matches an address: that
  // would turn this into a way to test which tokens are real.
  return new Response(
    page(
      "Unsubscribe from this newsletter?",
      "You won't get any more newsletters from this page. You can sign up again any time from the page itself.",
      `<form method="post"><input type="hidden" name="t" value="${token}"><button type="submit">Yes, unsubscribe me</button></form>`
    ),
    { status: 200, headers: HEADERS }
  );
}

/**
 * Actually unsubscribe.
 *
 * Reached two ways: the confirmation form above, and the native one-click
 * button in Gmail/Outlook, which POSTs `List-Unsubscribe=One-Click` per RFC
 * 8058 and reads the token from the query string.
 */
export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let token = url.searchParams.get("t") ?? "";

  if (!token) {
    try {
      const form = await req.formData();
      token = String(form.get("t") ?? "");
    } catch {
      /* one-click senders may post a body we don't need to read */
    }
  }

  const ok = VALID_TOKEN.test(token) && unsubscribeLeadByToken(token);
  return new Response(
    ok
      ? page(
          "You're unsubscribed",
          "You won't get any more newsletters from this page. Changed your mind? Sign up again any time from the page itself."
        )
      : page(
          "That link didn't work",
          "It may have been trimmed by your mail app — try copying the whole unsubscribe link from the email."
        ),
    { status: ok ? 200 : 400, headers: HEADERS }
  );
}
