import { billingOk } from "@/lib/billing";
import { getSiteByToken, recordPageView, cleanReferrer } from "@/lib/db";
import { buildEmbedContent } from "@/lib/embed";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  const site = getSiteByToken(token);
  // Draft sites 404 like an unknown token — Unpublish must take content down
  // everywhere at once, embeds included, just like the hosted page. The same
  // applies to sites without a live subscription once billing is enabled.
  if (!site || !site.published || !billingOk(site)) {
    return Response.json({ error: "Unknown site token" }, { status: 404, headers: CORS });
  }

  // Embedded views land in Analytics with the embedding website as the referrer.
  let refHost = "";
  try {
    refHost = new URL(req.headers.get("referer") ?? "").host;
  } catch {}
  recordPageView(site.id, refHost === (req.headers.get("host") ?? "") ? "" : cleanReferrer(refHost));

  return Response.json(buildEmbedContent(site), { headers: CORS });
}
