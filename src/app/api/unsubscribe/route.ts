import { unsubscribeLeadByToken } from "@/lib/db";

/**
 * Unsubscribe, from the link in every newsletter.
 *
 * GET only confirms; POST is what actually opts the address out. It used to
 * mutate on GET, which reads well ("one click, done") right up until you
 * remember who else follows links in mail: corporate security gateways —
 * Proofpoint, Mimecast, Defender Safe Links — fetch every URL in a message to
 * scan it. Every recipient behind one was unsubscribed before a human saw the
 * mail, and nothing distinguished that from a real opt-out.
 *
 * The POST form on the confirmation page is one click, so the human cost is a
 * button; and because RFC 8058's one-click header also sends a POST, the native
 * Gmail/Outlook unsubscribe button lands on the same handler and still works
 * without the extra step.
 */

const STYLE =
  "body{margin:0;display:grid;place-items:center;min-height:100vh;background:#0a0812;color:#e8e6f0;" +
  "font-family:system-ui,-apple-system,sans-serif}main{max-width:26rem;padding:2rem;text-align:center}" +
  "h1{font-size:1.4rem}p{color:#9b96ad;line-height:1.6}" +
  "button{margin-top:1.25rem;padding:.7rem 1.4rem;border-radius:.75rem;border:0;background:#8b5cf6;" +
  "color:#fff;font:inherit;font-weight:600;cursor:pointer}";

function page(title: string, body: string, form = ""): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>${STYLE}</style>
</head><body><main><h1>${title}</h1><p>${body}</p>${form}</main></body></html>`;
}

const HTML = {
  "Content-Type": "text/html; charset=utf-8",
  // Never cached, and never indexed: the URL carries a per-address secret.
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

const DONE = page(
  "You're unsubscribed",
  "You won't get any more newsletters from this page. Changed your mind? Sign up again any time from the page itself."
);
const BAD = page(
  "That link didn't work",
  "It may have been trimmed by your mail app — try copying the whole unsubscribe link from the email."
);

function validToken(req: Request): string {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  return /^[0-9a-f]{32}$/.test(token) ? token : "";
}

export async function GET(req: Request): Promise<Response> {
  const token = validToken(req);
  if (!token) return new Response(BAD, { status: 400, headers: HTML });
  return new Response(
    page(
      "Unsubscribe?",
      "Confirm and you'll stop receiving newsletters from this page.",
      `<form method="post"><button type="submit">Unsubscribe me</button></form>`
    ),
    { status: 200, headers: HTML }
  );
}

export async function POST(req: Request): Promise<Response> {
  const token = validToken(req);
  // Idempotent: a second submit lands on the same confirmation, never an error.
  const ok = !!token && unsubscribeLeadByToken(token);
  return new Response(ok ? DONE : BAD, { status: ok ? 200 : 400, headers: HTML });
}
