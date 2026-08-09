import fs from "fs";
import path from "path";
import { ADMIN_EMAIL, getCurrentUser } from "@/lib/auth";
import { getQuoteById } from "@/lib/db";

/** Download a quote request's uploaded project zip — admin only. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || user.email !== ADMIN_EMAIL) return new Response("Forbidden", { status: 403 });

  const { id } = await ctx.params;
  const quote = getQuoteById(Number(id));
  if (!quote || !quote.fileName) return new Response("Not found", { status: 404 });

  // fileName is server-generated (quote-<id>-<sanitized>), but stay paranoid about traversal.
  const dir = path.join(process.cwd(), "data", "uploads");
  const filePath = path.join(dir, path.basename(quote.fileName));
  if (!fs.existsSync(filePath)) return new Response("File missing on disk", { status: 404 });

  return new Response(new Uint8Array(fs.readFileSync(filePath)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${quote.fileName}"`,
    },
  });
}
