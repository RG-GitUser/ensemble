import { billingOk } from "@/lib/billing";
import { getConnection, getSiteByToken, replaceSiteContent, upsertConnection } from "@/lib/db";
import { LIMITS, rateLimit } from "@/lib/ratelimit";
import { consumeReportNonce } from "@/lib/report-nonce";

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
 * The token is public by nature (it ships in the snippet on a public page), so
 * it CANNOT be the authorization for a destructive write. This endpoint
 * replaces the site's entire content inventory, so it additionally requires:
 *
 *   - a single-use nonce, minted by the overrides endpoint only when a report
 *     is actually wanted (see lib/report-nonce.ts);
 *   - a matching host, once we know which host the snippet lives on;
 *   - a per-site rate limit;
 *   - and the caps below applied BEFORE parsing, not after.
 *
 * replaceSiteContent also snapshots the creator's edits first, so a report
 * that does get through is undoable.
 */

const KINDS = new Set(["text", "image", "video"]);
const MAX_ITEMS = 300;
const MAX_SELECTOR = 500;
const MAX_VALUE = 5_000;

/**
 * Hard ceiling on the request body.
 *
 * next.config.ts's bodySizeLimit applies to server actions, not route
 * handlers, and Caddy sets no request_body limit — so `await req.json()`
 * buffered whatever was sent, `.filter()` walked the whole array, and the caps
 * above only ever bounded what got STORED. Because better-sqlite3 is
 * synchronous, the transaction that followed blocked the single Node process
 * for every other tenant.
 */
const MAX_BODY_BYTES = 512 * 1024;
const MAX_RAW_ITEMS = MAX_ITEMS * 4;

interface Reported {
  selector: string;
  kind: string;
  original: string;
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS });
}

/** The host a browser request came from, for pinning against the paired site. */
function requestHost(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin && origin !== "null") {
    try {
      return new URL(origin).host;
    } catch {
      /* fall through to referer */
    }
  }
  try {
    return new URL(req.headers.get("referer") ?? "").host;
  } catch {
    return "";
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  const site = getSiteByToken(token);
  if (!site) return Response.json({ error: "Unknown site token" }, { status: 404, headers: CORS });
  // A lapsed or unpublished site does not get to keep rewriting its paired
  // inventory — same rule the content endpoint applies.
  if (!site.published || !billingOk(site)) {
    return Response.json({ error: "Unknown site token" }, { status: 404, headers: CORS });
  }

  // The showcase sites publish their embed token in public HTML on purpose
  // (/embed-demo renders it), which would otherwise make them a convenient
  // place to exercise this endpoint without first having to find a real
  // customer's token. They have no paired website, so they have no reason to
  // report content either.
  if (site.slug === "demo" || site.slug === "hq") {
    return Response.json({ error: "Report not expected" }, { status: 409, headers: CORS });
  }

  const limit = rateLimit(`report:${site.id}`, LIMITS.contentReport);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many reports" },
      { status: 429, headers: { ...CORS, "Retry-After": String(limit.retryAfter) } }
    );
  }

  // Refuse the body before reading it when the sender has declared it too big.
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ error: "Report too large" }, { status: 413, headers: CORS });
  }

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Report too large" }, { status: 413, headers: CORS });
  }

  let body: { url?: unknown; items?: unknown; nonce?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400, headers: CORS });
  }

  // The write capability, which the public token does not carry.
  if (typeof body.nonce !== "string" || !consumeReportNonce(body.nonce, site.id)) {
    return Response.json({ error: "Report not expected" }, { status: 409, headers: CORS });
  }

  // Once we know where the snippet lives, reports have to come from there.
  const connection = getConnection(site.id);
  const host = requestHost(req);
  if (connection?.seenHost && host && host !== connection.seenHost) {
    return Response.json({ error: "Report from unexpected host" }, { status: 403, headers: CORS });
  }

  const raw = Array.isArray(body.items) ? body.items : [];
  // Bound the ARRAY before walking it, not after.
  if (raw.length > MAX_RAW_ITEMS) {
    return Response.json({ error: "Report too large" }, { status: 413, headers: CORS });
  }

  const items: Array<{ selector: string; kind: string; original: string; position: number }> = [];
  for (const candidate of raw as Reported[]) {
    if (items.length >= MAX_ITEMS) break;
    if (
      !candidate ||
      typeof candidate.selector !== "string" ||
      typeof candidate.original !== "string" ||
      typeof candidate.kind !== "string" ||
      !KINDS.has(candidate.kind) ||
      candidate.selector.length === 0 ||
      candidate.selector.length > MAX_SELECTOR ||
      candidate.original.length === 0
    ) {
      continue;
    }
    items.push({
      selector: candidate.selector,
      kind: candidate.kind,
      // Truncated as it is accepted, so an oversized value is never carried.
      original: candidate.original.slice(0, MAX_VALUE),
      position: items.length + 1,
    });
  }

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
  // Carries existing edits across, and snapshots them first.
  replaceSiteContent(site.id, items);

  return Response.json({ ok: true, count: items.length }, { headers: CORS });
}
