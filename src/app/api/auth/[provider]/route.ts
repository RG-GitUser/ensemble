import { cookies, headers } from "next/headers";
import { randomBytes } from "crypto";
import {
  buildLoginAuthorizeUrl,
  getLoginProvider,
  loginProviderCredentials,
  loginRedirectUri,
} from "@/lib/login-providers";

export const LOGIN_STATE_COOKIE = "ens_login_state";

/**
 * Start "Continue with Google / Microsoft / Yahoo".
 *
 * A separate route and a separate state cookie from /api/oauth/[platform],
 * which connects a publishing account to a site the caller is already signed
 * in to. This one mints a session, so the two must never be able to satisfy
 * each other's callback: a state value issued here is only ever accepted at
 * /api/auth/[provider]/callback, and vice versa.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ provider: string }> }): Promise<Response> {
  const base = await origin();
  const { provider: id } = await ctx.params;

  const provider = getLoginProvider(id);
  if (!provider) return Response.redirect(new URL("/login", base), 302);

  const creds = loginProviderCredentials(provider);
  if (!creds) return Response.redirect(new URL(`/login?sso=not-configured&provider=${id}`, base), 302);

  // Run the whole exchange on the canonical origin, starting here — the same
  // reason as the publishing flow: redirect_uri is registered against one
  // host, and the state cookie below is host-only, so leaving from www and
  // returning to the apex would arrive with no cookie to compare against.
  const redirectUri = loginRedirectUri(base, id);
  const canonical = new URL(redirectUri).origin;
  if (canonical !== base) return Response.redirect(`${canonical}/api/auth/${id}`, 302);

  // The provider id travels inside the cookie value, so a callback cannot be
  // replayed against a different provider while the state is still valid.
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set(LOGIN_STATE_COOKIE, `${id}:${state}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: base.startsWith("https://"),
    maxAge: 600,
    path: "/",
  });

  return Response.redirect(buildLoginAuthorizeUrl(provider, creds.clientId, redirectUri, state), 302);
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
