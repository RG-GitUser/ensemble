import { getCurrentUser } from "@/lib/auth";
import { getLeads, getSiteByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const site = getSiteByUser(user.id);
  if (!site || !getPlan(site.plan).newsletter) return new Response("Forbidden", { status: 403 });

  // Status included so an import into a real ESP can honour opt-outs.
  const rows = [
    ["email", "subscribed_at", "status"],
    ...getLeads(site.id).map((l) => [l.email, l.createdAt, l.unsubscribedAt ? "unsubscribed" : "subscribed"]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${site.slug}-subscribers.csv"`,
    },
  });
}
