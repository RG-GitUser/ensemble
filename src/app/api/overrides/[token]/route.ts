import { getConnection, getEditedContent, getSiteByToken, touchConnection } from "@/lib/db";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

/**
 * Content overrides for a paired external website. Served to the pasted
 * connect.js snippet; only carries values the creator explicitly edited.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  const site = getSiteByToken(token);
  const connection = site ? getConnection(site.id) : null;
  if (!site || !connection || !connection.enabled) {
    return Response.json({ error: "Unknown site token" }, { status: 404, headers: CORS });
  }

  // Pairing heartbeat: remember the snippet was seen, and on which host.
  let refHost = "";
  try {
    refHost = new URL(req.headers.get("referer") ?? "").host;
  } catch {}
  touchConnection(site.id, refHost);

  const items = getEditedContent(site.id).map((i) => ({ selector: i.selector, kind: i.kind, value: i.edited }));
  return Response.json({ items }, { headers: CORS });
}
