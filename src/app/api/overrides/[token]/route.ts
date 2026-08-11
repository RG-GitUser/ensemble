import { countSiteContent, getConnection, getEditedContent, getSiteByToken, touchConnection } from "@/lib/db";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

/**
 * Content overrides for a paired external website, served to the pasted
 * connect.js snippet. Only carries values the creator explicitly edited.
 *
 * Also drives discovery: `report: true` asks the snippet to walk the page and
 * POST what it finds to /api/content/<token>/report. That happens before the
 * site is paired at all (no connection row yet), which is how pasting the
 * snippet — and nothing else — is enough to connect a website.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  const site = getSiteByToken(token);
  if (!site) return Response.json({ error: "Unknown site token" }, { status: 404, headers: CORS });

  const connection = getConnection(site.id);

  // Pairing heartbeat: remember the snippet was seen, and on which host.
  let refHost = "";
  try {
    refHost = new URL(req.headers.get("referer") ?? "").host;
  } catch {}
  if (connection) touchConnection(site.id, refHost);

  // Ask for a report when the site has never been read, when the dashboard
  // requested a re-sync, or when the inventory is somehow empty.
  const report = !connection || connection.needsReport || countSiteContent(site.id) === 0;

  // A paused connection keeps reporting (so the editor stays current) but
  // stops serving overrides, which is what "paused" means to the creator.
  // `original` rides along so the snippet can re-find an element by its own
  // text when the selector misses — a redesign that moves a heading shouldn't
  // silently drop the creator's edit.
  const items =
    connection && connection.enabled
      ? getEditedContent(site.id).map((i) => ({
          selector: i.selector,
          kind: i.kind,
          value: i.edited,
          original: i.original,
        }))
      : [];

  return Response.json({ items, report }, { headers: CORS });
}
