import { cookies, headers } from "next/headers";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { getSiteByUser } from "@/lib/db";
import { buildAuthorizeUrl, getOAuthProvider, oauthOrigin, oauthRedirectUri, providerCredentials } from "@/lib/oauth";

export const STATE_COOKIE = "ens_oauth_state";

/**
 * Start the OAuth dance for any registered provider. One route for every
 * platform — the differences live in the registry, not here.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ platform: string }> }): Promise<Response> {
  const base = await origin();
  const { platform } = await ctx.params;

  const provider = getOAuthProvider(platform);
  if (!provider) return Response.redirect(new URL("/dashboard/integrations", base), 302);

  const user = await getCurrentUser();
  const site = user ? getSiteByUser(user.id) : null;
  if (!site) return Response.redirect(new URL("/login", base), 302);

  const creds = providerCredentials(provider);
  if (!creds) return back(base, platform, "not-configured");

  // Run the whole dance on the canonical origin, starting here.
  //
  // The redirect_uri has to be the registered one, so the provider will send
  // the creator back to that host whatever host they left from. The state
  // cookie set below is host-only, so leaving from www and returning to the
  // apex would arrive with neither the state cookie nor a session. Moving them
  // across before anything is issued keeps cookie, callback and redirect_uri
  // on one host.
  const canonical = oauthOrigin(base);
  if (canonical !== base) return Response.redirect(`${canonical}/api/oauth/${platform}`, 302);

  // The state cookie carries the platform too, so a callback can't be replayed
  // against a different provider with a still-valid state value.
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set(STATE_COOKIE, `${platform}:${state}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: base.startsWith("https://"),
    maxAge: 600,
    path: "/",
  });

  return Response.redirect(
    buildAuthorizeUrl(provider, creds.clientId, oauthRedirectUri(base, platform), state),
    302
  );
}

function back(base: string, platform: string, code: string): Response {
  return Response.redirect(new URL(`/dashboard/integrations?oauth=${code}&platform=${platform}`, base), 302);
}

async function origin(): Promise<string> {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}
