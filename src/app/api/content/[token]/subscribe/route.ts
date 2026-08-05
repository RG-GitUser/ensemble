import { addLead, getSiteByToken } from "@/lib/db";
import { getPlan } from "@/lib/plans";

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
