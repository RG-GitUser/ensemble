import { addLead, getSiteByToken } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { ipFromHeaders, LIMITS, rateLimit } from "@/lib/ratelimit";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  const site = getSiteByToken(token);
  if (!site || !site.published) {
    return Response.json({ error: "Unknown site token" }, { status: 404, headers: CORS });
  }
  if (!getPlan(site.plan).newsletter) {
    return Response.json({ error: "Newsletter is not enabled on this page." }, { status: 403, headers: CORS });
  }

  // Open to any origin by design, which makes this the easiest lead table in
  // the app to flood. Shares one bucket with the hosted page's signup action,
  // so going through the embed instead does not hand anyone a second budget.
  const limit = rateLimit(`newsletter:${ipFromHeaders(req.headers)}`, LIMITS.newsletter);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many signups from this connection. Try again in a few minutes." },
      { status: 429, headers: { ...CORS, "Retry-After": String(limit.retryAfter) } },
    );
  }

  // Sent as text/plain to skip the CORS preflight, so parse by hand.
  let email = "";
  try {
    email = String(JSON.parse(await req.text()).email ?? "")
      .trim()
      .toLowerCase();
  } catch {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400, headers: CORS });
  }

  addLead(site.id, email);
  return Response.json({ ok: true }, { headers: CORS });
}
