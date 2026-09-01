import { unsubscribeLeadByToken } from "@/lib/db";

/**
 * One-click unsubscribe, straight from the link in every newsletter.
 *
 * A GET on purpose: the person clicking is in their mail client, not our UI,
 * and the token in the link is the whole proof of identity. Idempotent — a
 * second click lands on the same confirmation, never an error.
 */
export async function GET(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const ok = /^[0-9a-f]{32}$/.test(token) && unsubscribeLeadByToken(token);

  const page = (title: string, body: string) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#0a0812;color:#e8e6f0;font-family:system-ui,-apple-system,sans-serif}main{max-width:26rem;padding:2rem;text-align:center}h1{font-size:1.4rem}p{color:#9b96ad;line-height:1.6}</style>
</head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;

  return new Response(
    ok
      ? page("You're unsubscribed", "You won't get any more newsletters from this page. Changed your mind? Sign up again any time from the page itself.")
      : page("That link didn't work", "It may have been trimmed by your mail app — try copying the whole unsubscribe link from the email."),
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
