import { cookies, headers } from "next/headers";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { getSiteByUser } from "@/lib/db";
import { buildAuthorizeUrl, getOAuthProvider, providerCredentials } from "@/lib/oauth";

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

  const redirectUri = `${base}/api/oauth/${platform}/callback`;
  return Response.redirect(buildAuthorizeUrl(provider, creds.clientId, redirectUri, state), 302);
}

function back(base: string, platform: string, code: string): Response {
  return Response.redirect(new URL(`/dashboard/integrations?oauth=${code}&platform=${platform}`, base), 302);
}

async function origin(): Promise<string> {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
}
