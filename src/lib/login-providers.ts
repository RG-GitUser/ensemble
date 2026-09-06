/*
 * Not server-only: the registry is plain data with no secrets, and the login
 * and signup pages need the names and ids to render the buttons. Credentials
 * are read through loginProviderCredentials(), which touches process.env and
 * is only ever called from route handlers.
 */

/**
 * Sign in with an account the creator already has.
 *
 * Deliberately separate from oauth.ts, which connects a PUBLISHING account to
 * an existing site and requires a session to already exist. This does the
 * opposite: it establishes who someone is and mints a session. Sharing one
 * registry would mean one bug in the wrong branch turns "post to my Threads"
 * into "sign in as anybody", so the two never share a route or a state cookie.
 *
 * Adding a provider means an entry here and a case in fetchLoginIdentity.
 */
export interface LoginProviderDef {
  id: string;
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  idEnv: string;
  secretEnv: string;
  /** Provider-specific authorize params (offline access, account pickers). */
  extraAuthParams?: Record<string, string>;
  /**
   * Whether the provider tells us, per response, that it verified the address.
   *
   * Google and Yahoo return an `email_verified` claim and we refuse the
   * sign-in without it. Microsoft Graph has no equivalent field, because the
   * address IS the account there — a work/school UPN is issued by the tenant
   * and a consumer MSA is proven at signup. So for Microsoft the guarantee
   * comes from the account model rather than from a claim, which is worth
   * stating plainly rather than leaving as an unexplained gap in the checks.
   */
  emailVerifiedClaim: boolean;
}

export const LOGIN_PROVIDERS: LoginProviderDef[] = [
  {
    id: "google",
    name: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
    idEnv: "GOOGLE_CLIENT_ID",
    secretEnv: "GOOGLE_CLIENT_SECRET",
    // prompt=select_account so a shared browser does not silently sign the
    // last person back in when someone presses "Continue with Google".
    extraAuthParams: { prompt: "select_account" },
    emailVerifiedClaim: true,
  },
  {
    id: "microsoft",
    name: "Microsoft",
    // /common accepts both work/school tenants and personal Outlook accounts.
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["openid", "email", "profile", "User.Read"],
    idEnv: "MICROSOFT_CLIENT_ID",
    secretEnv: "MICROSOFT_CLIENT_SECRET",
    extraAuthParams: { prompt: "select_account" },
    emailVerifiedClaim: false,
  },
  {
    id: "yahoo",
    name: "Yahoo",
    authorizeUrl: "https://api.login.yahoo.com/oauth2/request_auth",
    tokenUrl: "https://api.login.yahoo.com/oauth2/get_token",
    scopes: ["openid", "email", "profile"],
    idEnv: "YAHOO_CLIENT_ID",
    secretEnv: "YAHOO_CLIENT_SECRET",
    emailVerifiedClaim: true,
  },
];

export function getLoginProvider(id: string): LoginProviderDef | undefined {
  return LOGIN_PROVIDERS.find((p) => p.id === id);
}

export function loginProviderConfigured(p: LoginProviderDef): boolean {
  return !!process.env[p.idEnv] && !!process.env[p.secretEnv];
}

/** Ids of every sign-in provider whose credentials are present. Server-side. */
export function configuredLoginProviderIds(): string[] {
  return LOGIN_PROVIDERS.filter(loginProviderConfigured).map((p) => p.id);
}

export function loginProviderCredentials(p: LoginProviderDef): { clientId: string; clientSecret: string } | null {
  const clientId = process.env[p.idEnv];
  const clientSecret = process.env[p.secretEnv];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** The exact redirect_uri for a provider — the same string at both steps. */
export function loginRedirectUri(origin: string, provider: string): string {
  const configured = (process.env.APP_URL || "").trim().replace(/\/$/, "");
  return `${configured || origin}/api/auth/${provider}/callback`;
}

export function buildLoginAuthorizeUrl(
  p: LoginProviderDef,
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const url = new URL(p.authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", p.scopes.join(" "));
  url.searchParams.set("state", state);
  for (const [k, v] of Object.entries(p.extraAuthParams ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

const TIMEOUT = 15_000;

/** Swap the authorization code for an access token. Null on any failure. */
export async function exchangeLoginCode(
  p: LoginProviderDef,
  creds: { clientId: string; clientSecret: string },
  code: string,
  redirectUri: string
): Promise<string | null> {
  try {
    const res = await fetch(p.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: unknown };
    return typeof json.access_token === "string" && json.access_token ? json.access_token : null;
  } catch {
    return null;
  }
}

async function getJson(url: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export interface LoginIdentity {
  email: string;
  name: string;
}

/**
 * Who is signing in, and did the provider actually verify the address?
 *
 * The verification question is the whole security of this feature. An address
 * we accept unverified is an account takeover: anyone who can persuade a
 * provider to issue a token naming victim@example.com becomes that user here,
 * including on an account that already exists with a password. So an
 * unverified claim returns null and the sign-in fails closed, rather than
 * falling back to "well, the provider said so".
 */
export async function fetchLoginIdentity(p: LoginProviderDef, token: string): Promise<LoginIdentity | null> {
  switch (p.id) {
    case "google": {
      const me = await getJson("https://openidconnect.googleapis.com/v1/userinfo", token);
      if (!me) return null;
      // Google sends this as a real boolean; some OIDC providers send "true".
      if (me.email_verified !== true && me.email_verified !== "true") return null;
      const email = str(me.email);
      return email ? { email, name: str(me.name) } : null;
    }

    case "microsoft": {
      const me = await getJson("https://graph.microsoft.com/v1.0/me", token);
      if (!me) return null;
      // `mail` is null on plenty of accounts that sign in perfectly well;
      // userPrincipalName is the address they actually authenticated with.
      const email = str(me.mail) || str(me.userPrincipalName);
      return email ? { email, name: str(me.displayName) } : null;
    }

    case "yahoo": {
      const me = await getJson("https://api.login.yahoo.com/openid/v1/userinfo", token);
      if (!me) return null;
      if (me.email_verified !== true && me.email_verified !== "true") return null;
      const email = str(me.email);
      return email ? { email, name: str(me.name) || str(me.given_name) } : null;
    }

    default:
      return null;
  }
}

/**
 * A last check on whatever the provider handed back.
 *
 * Graph's userPrincipalName is not always an address — guest accounts carry
 * forms like `someone_example.com#EXT#@tenant.onmicrosoft.com`. Storing one as
 * an email would create an account nobody can receive mail at, which then
 * cannot be recovered, and would collide oddly against the users table's
 * UNIQUE(email). Anything that is not a plain single-@ address is refused.
 */
export function usableLoginEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  if (/\s/.test(trimmed) || trimmed.includes("#")) return false;
  return /^[^@]+@[^@]+\.[^@]+$/.test(trimmed);
}
