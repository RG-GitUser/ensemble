import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getSiteByUser, upsertSocialAccount } from "@/lib/db";

const TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const GRAPH = "https://graph.threads.net";

/** Complete the Threads OAuth dance: code → long-lived token → store account. */
export async function GET(req: Request): Promise<Response> {
  const base = await origin();
  const back = (q: string) => Response.redirect(new URL(`/dashboard/integrations?oauth=${q}`, base), 302);

  const user = await getCurrentUser();
  const site = user ? getSiteByUser(user.id) : null;
  if (!site) return Response.redirect(new URL("/login", base), 302);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const savedState = jar.get("threads_oauth_state")?.value;
  jar.delete("threads_oauth_state");
  if (!code || !state || !savedState || state !== savedState) return back("denied");

  const appId = process.env.THREADS_APP_ID ?? "";
  const appSecret = process.env.THREADS_APP_SECRET ?? "";
  if (!appId || !appSecret) return back("missing-creds");

  try {
    // Authorization code → short-lived token.
    const shortRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: "authorization_code",
        redirect_uri: `${base}/api/oauth/threads/callback`,
        code,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!shortRes.ok) return back("token-failed");
    const short = (await shortRes.json()) as { access_token: string };

    // Short-lived → long-lived (~60 days).
    const longRes = await fetch(
      `${GRAPH}/access_token?grant_type=th_exchange_token&client_secret=${encodeURIComponent(appSecret)}&access_token=${encodeURIComponent(short.access_token)}`,
      { signal: AbortSignal.timeout(20_000) }
    );
    if (!longRes.ok) return back("token-failed");
    const long = (await longRes.json()) as { access_token: string; expires_in?: number };

    const meRes = await fetch(
      `${GRAPH}/v1.0/me?fields=id,username&access_token=${encodeURIComponent(long.access_token)}`,
      { signal: AbortSignal.timeout(20_000) }
    );
    if (!meRes.ok) return back("profile-failed");
    const me = (await meRes.json()) as { id: string; username: string };

    const expiresAt = new Date(Date.now() + (long.expires_in ?? 60 * 24 * 3600) * 1000).toISOString();
    upsertSocialAccount(site.id, "threads", me.username, {
      authKind: "oauth",
      secret: long.access_token,
      expiresAt,
      externalId: me.id,
    });
    return back("connected");
  } catch {
    return back("error");
  }
}

async function origin(): Promise<string> {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}
