import fs from "fs";
import path from "path";

// Serves theme images uploaded by creators (stored in data/uploads). The CSP
// header neutralizes any active content, so even a hostile SVG opened
// directly can't run scripts on our origin. Only image extensions are served
// — quote-request zips living in the same folder stay unreachable.
//
// These URLs are unauthenticated by design: they are referenced from public
// creator pages and from the embed on external sites, so requiring a session
// would break the product. What they are NOT is unguessable — the names are
// `theme-<siteId>-<kind>-<Date.now()>.<ext>`, so a background belonging to an
// unpublished page can be found by walking timestamps. Path traversal is
// genuinely closed (the regex below admits no slashes or dots-only names), and
// the risk here is disclosure of a draft's imagery rather than anything
// executable.
//
// Renaming to a random id is the real fix and is a migration: every stored
// config value references the current name. Worth doing before launch if draft
// imagery is considered sensitive; noted here rather than left implicit.
const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  // Tab icons are often .ico; without this they store fine and 404 on serve.
  ico: "image/x-icon",
};

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }): Promise<Response> {
  const { name } = await ctx.params;
  if (!/^[\w][\w.-]*$/.test(name)) return new Response(null, { status: 404 });
  const type = TYPES[name.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return new Response(null, { status: 404 });

  let buf: Buffer;
  try {
    buf = fs.readFileSync(path.join(process.cwd(), "data", "uploads", name));
  } catch {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      // File names are unique per save, so long-lived caching is safe.
      "Cache-Control": "public, max-age=604800, immutable",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
