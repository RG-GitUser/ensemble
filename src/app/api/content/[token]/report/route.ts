import { getSiteByToken, replaceSiteContent, upsertConnection } from "@/lib/db";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

/**
 * Content discovery, reported by the pasted snippet from the creator's own
 * browser.
 *
 * This replaced a server-side fetch of the creator's HTML, which failed on
 * the two most common cases: bot-protection firewalls rejected the request,
 * and JavaScript-rendered sites (Squarespace, Wix, any SPA) served an empty
 * shell. Reading the live DOM instead means the selectors we store are the
 * same ones the snippet will query later — they match by construction.
 *
 * The token is public by nature (it ships in the snippet on a public page),
 * so a report is only ever trusted to describe *that* site's own content.
 * Everything is bounded below, and a bad report is repaired by re-syncing.
 */

const KINDS = new Set(["text", "image", "video"]);
const MAX_ITEMS = 300;
const MAX_SELECTOR = 500;
const MAX_VALUE = 5_000;

interface Reported {
  selector: string;
  kind: string;
  original: string;
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  const site = getSiteByToken(token);
  if (!site) return Response.json({ error: "Unknown site token" }, { status: 404, headers: CORS });

  let body: { url?: unknown; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400, headers: CORS });
  }

  const raw = Array.isArray(body.items) ? body.items : [];
  const items = (raw as Reported[])
    .filter(
      (i) =>
        i &&
        typeof i.selector === "string" &&
        typeof i.original === "string" &&
        typeof i.kind === "string" &&
        KINDS.has(i.kind) &&
        i.selector.length > 0 &&
        i.selector.length <= MAX_SELECTOR &&
        i.original.length > 0
    )
    .slice(0, MAX_ITEMS)
    .map((i, idx) => ({
      selector: i.selector,
      kind: i.kind,
      original: i.original.slice(0, MAX_VALUE),
      position: idx + 1,
    }));

  if (items.length === 0) {
    return Response.json({ error: "No editable content in report" }, { status: 400, headers: CORS });
  }

  // Prefer the page URL the snippet reported; fall back to its Referer.
  let url = typeof body.url === "string" ? body.url.slice(0, 2000) : "";
  if (!/^https?:\/\//i.test(url)) url = req.headers.get("referer") ?? "";
  if (!/^https?:\/\//i.test(url)) url = "";

  // Creates the connection on first report, and clears needs_report so the
  // snippet stops re-reporting on every page load.
  upsertConnection(site.id, url);
  // Carries existing edits across by selector + kind + original.
  replaceSiteContent(site.id, items);

  return Response.json({ ok: true, count: items.length }, { headers: CORS });
}
