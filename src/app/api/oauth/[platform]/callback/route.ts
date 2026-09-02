import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { getSiteByUser, upsertSocialAccount } from "@/lib/db";
import { getOAuthProvider, oauthRedirectUri, providerCredentials, type ConnectErrorCode } from "@/lib/oauth";
import { exchangeCode, fetchIdentity } from "@/lib/oauth-connect";
import { STATE_COOKIE } from "../route";

/**
 * Finish the OAuth dance for any registered provider.
 *
 * Every exit goes back to the integrations page with a `?oauth=` code, which
 * the page turns into a plain-English message. Nothing here ever returns a
 * bare error page or a raw platform message — a creator who lands on a blank
 * "token-failed" learns nothing and files a support ticket.
 */
export async function GET(req: Request, ctx: { params: Promise<{ platform: string }> }): Promise<Response> {
  const base = await origin();
  const { platform } = await ctx.params;
  const back = (code: ConnectErrorCode | "connected" | "connected-not-postable") =>
    Response.redirect(new URL(`/dashboard/integrations?oauth=${code}&platform=${platform}`, base), 302);

  const provider = getOAuthProvider(platform);
  if (!provider) return Response.redirect(new URL("/dashboard/integrations", base), 302);

  const user = await getCurrentUser();
  const site = user ? getSiteByUser(user.id) : null;
  if (!site) return Response.redirect(new URL("/login", base), 302);

  // Single-use state, and it must belong to this platform.
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const saved = jar.get(STATE_COOKIE)?.value ?? "";
  jar.delete(STATE_COOKIE);

  if (url.searchParams.get("error")) return back("denied");
  if (!code || !state || saved !== `${platform}:${state}`) return back("state-mismatch");

  const creds = providerCredentials(provider);
  if (!creds) return back("not-configured");

  try {
    // Must be byte-identical to the value sent at the authorize step.
    const tokens = await exchangeCode(provider, creds, code, oauthRedirectUri(base, platform));
    if (!tokens) return back("token-failed");

    const result = await fetchIdentity(provider, tokens.accessToken);
    if (!result) return back("identity-failed");

    // Store either way. A not-postable account is still connected, and keeping
    // it lets the dashboard show precisely what to fix instead of losing the
    // link and making them start over.
    upsertSocialAccount(site.id, platform, result.identity.handle, {
      authKind: "oauth",
      secret: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      externalId: result.identity.externalId,
    });

    return back(result.probe.postable ? "connected" : "connected-not-postable");
  } catch {
    return back("network");
  }
}

async function origin(): Promise<string> {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}
