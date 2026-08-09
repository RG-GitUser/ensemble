import fs from "fs";
import path from "path";

// Serves theme images uploaded by creators (stored in data/uploads). The CSP
// header neutralizes any active content, so even a hostile SVG opened
// directly can't run scripts on our origin. Only image extensions are served
// — quote-request zips living in the same folder stay unreachable.
const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
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
