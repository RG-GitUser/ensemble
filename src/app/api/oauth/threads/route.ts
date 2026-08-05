import { cookies, headers } from "next/headers";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { getSiteByUser } from "@/lib/db";

/**
 * Kick off the Threads OAuth dance. Requires Ensemble's Meta app credentials
 * (THREADS_APP_ID / THREADS_APP_SECRET in .env). In Meta dev mode this works
 * for accounts with a role on the app — public users need the app reviewed.
 */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  const site = user ? getSiteByUser(user.id) : null;
  if (!site) return Response.redirect(new URL("/login", await origin()), 302);

  const appId = process.env.THREADS_APP_ID;
  if (!appId || !process.env.THREADS_APP_SECRET) {
    return Response.redirect(new URL("/dashboard/integrations?oauth=missing-creds", await origin()), 302);
  }

  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("threads_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });

  const url = new URL("https://threads.net/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", `${await origin()}/api/oauth/threads/callback`);
  url.searchParams.set("scope", "threads_basic,threads_content_publish");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return Response.redirect(url, 302);
}

async function origin(): Promise<string> {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}
