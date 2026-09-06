import { cookies, headers } from "next/headers";
import { startSession } from "@/lib/auth";
import { createUser, getUserByEmail, isLockedAccount, oauthOnlyHash } from "@/lib/db";
import {
  exchangeLoginCode,
  fetchLoginIdentity,
  getLoginProvider,
  loginProviderCredentials,
  loginRedirectUri,
  usableLoginEmail,
} from "@/lib/login-providers";
import { clientIp, LIMITS, rateLimit } from "@/lib/ratelimit";
import { LOGIN_STATE_COOKIE } from "../route";

/**
 * Finish "Continue with Google / Microsoft / Yahoo" and mint a session.
 *
 * Everything here fails closed and lands on /login with a code the page can
 * explain, because the alternative — a raw provider message or a blank error
 * page — is where people give up. Nothing tells the visitor whether the
 * address already had an account: /forgot and /recover go to some trouble to
 * be enumeration-safe and this must not be the endpoint that gives it away.
 */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }): Promise<Response> {
  const base = await origin();
  const { provider: id } = await ctx.params;
  const back = (code: string) => Response.redirect(new URL(`/login?sso=${code}`, base), 302);

  const jar = await cookies();
  const cookieValue = jar.get(LOGIN_STATE_COOKIE)?.value ?? "";
  // Spend the state before anything else can go wrong with it. A state that
  // survives a failed attempt is a state that can be replayed.
  jar.delete(LOGIN_STATE_COOKIE);

  const limit = rateLimit(`sso:${await clientIp()}`, LIMITS.sso);
  if (!limit.ok) return back("rate-limited");

  const provider = getLoginProvider(id);
  if (!provider) return back("unknown-provider");

  const url = new URL(req.url);
  // The visitor pressed cancel, or the provider refused. Not an error worth
  // shouting about.
  if (url.searchParams.get("error")) return back("cancelled");

  const [cookieProvider, cookieState] = cookieValue.split(":");
  const state = url.searchParams.get("state") ?? "";
  if (!cookieState || cookieProvider !== id || state !== cookieState) return back("expired");

  const creds = loginProviderCredentials(provider);
  if (!creds) return back("not-configured");

  const code = url.searchParams.get("code") ?? "";
  if (!code) return back("failed");

  const redirectUri = loginRedirectUri(base, id);
  const token = await exchangeLoginCode(provider, creds, code, redirectUri);
  if (!token) return back("failed");

  // Returns null unless the provider actually verified the address. Accepting
  // an unverified one would mean anyone who can get a token issued naming
  // someone else's address becomes that user here — including on an account
  // that already exists with a password.
  const identity = await fetchLoginIdentity(provider, token);
  if (!identity || !usableLoginEmail(identity.email)) return back("no-email");

  const email = identity.email.trim().toLowerCase();
  const existing = getUserByEmail(email);

  if (existing) {
    // The demo account's whole point is that it cannot be logged into. It was
    // already reachable through password reset once (AUTH-6); this must not
    // become the second way in.
    if (isLockedAccount(existing.passwordHash)) return back("unavailable");
    await startSession(existing.id);
    return Response.redirect(new URL("/dashboard", base), 302);
  }

  // New account. No password is set — oauthOnlyHash() is unmatchable, so
  // "sign in with password" cannot be used against it until they choose one.
  // businessName seeds from their display name; onboarding is where both get
  // confirmed, and it is the next screen either way.
  const name = identity.name.trim() || email.split("@")[0];
  const user = createUser(email, oauthOnlyHash(), name, name);
  await startSession(user.id);
  return Response.redirect(new URL("/onboarding", base), 302);
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
