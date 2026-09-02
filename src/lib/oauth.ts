/**
 * Declarative OAuth provider registry.
 *
 * Adding a platform should mean adding an entry here — not another hand-rolled
 * route pair. Everything the generic routes in /api/oauth/[platform] need is
 * described below, alongside the human-facing copy that makes connecting
 * survivable for someone who has never heard the word "scope".
 *
 * ── A NOTE ON THE ENDPOINTS ──────────────────────────────────────────────
 * Platform OAuth URLs, scope names and API versions change often, and none of
 * these are verified against a live app yet (no credentials registered). Treat
 * every `authorizeUrl` / `tokenUrl` / `scopes` value as a starting point and
 * confirm it against the provider's current docs while registering the app —
 * see docs/social-app-registration.md. The Threads entry is the exception:
 * it mirrors the flow that was already working in this codebase.
 */

export type TokenAuth = "body" | "basic";

/** One thing the creator must have sorted before connecting will work. */
export interface Prereq {
  /** The requirement, in their words, not the platform's. */
  need: string;
  /** The literal taps. Short, ordered, no jargon. */
  steps: string[];
}

export interface OAuthProvider {
  /** Matches the id in PLATFORMS (social.ts). */
  id: string;
  name: string;
  /** Env vars holding the app credentials. */
  idEnv: string;
  secretEnv: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Extra params some providers require on the authorize URL. */
  extraAuthParams?: Record<string, string>;
  /** Reddit and Pinterest want HTTP Basic on the token endpoint; Meta wants form fields. */
  tokenAuth: TokenAuth;
  /**
   * Meta platforms return a ~1 hour token that must be swapped for a ~60 day
   * one. Skipping this step is silent: connecting looks fine and every
   * scheduled post more than an hour out fails.
   */
  longLived?: { url: string; grantType: string; tokenParam: string; sendClientId?: boolean };
  /** Shown before the connect button, so nobody discovers a blocker mid-flow. */
  prereqs: Prereq[];
  /** Set expectations honestly — half the support load is unmet assumptions. */
  can: string[];
  cannot: string[];
  /** Where the owner registers the app (for the setup checklist, not the creator). */
  consoleUrl: string;
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: "threads",
    name: "Threads",
    idEnv: "THREADS_APP_ID",
    secretEnv: "THREADS_APP_SECRET",
    authorizeUrl: "https://threads.net/oauth/authorize",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
    scopes: ["threads_basic", "threads_content_publish"],
    tokenAuth: "body",
    longLived: {
      url: "https://graph.threads.net/access_token",
      grantType: "th_exchange_token",
      tokenParam: "access_token",
    },
    prereqs: [
      {
        need: "A Threads account (it comes with your Instagram login)",
        steps: ["Open the Threads app and make sure you can post normally", "That's it — nothing to switch on"],
      },
    ],
    can: ["Publish text posts on a schedule", "Publish posts with one image"],
    cannot: ["Reply to comments", "Post to someone else's Threads account"],
    consoleUrl: "https://developers.facebook.com/apps",
  },
  {
    id: "instagram",
    name: "Instagram",
    idEnv: "INSTAGRAM_APP_ID",
    secretEnv: "INSTAGRAM_APP_SECRET",
    authorizeUrl: "https://www.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    tokenAuth: "body",
    longLived: {
      url: "https://graph.instagram.com/access_token",
      grantType: "ig_exchange_token",
      tokenParam: "access_token",
    },
    prereqs: [
      {
        // The single biggest source of "it connected but doesn't work".
        need: "A Business or Creator account — Instagram blocks scheduled posting on personal accounts",
        steps: [
          "Open Instagram → your profile",
          "Tap the menu button (three lines, top right) → Settings and privacy",
          "Tap Account type and tools → Switch to professional account",
          "Pick Creator (or Business) and finish the prompts",
        ],
      },
    ],
    can: ["Publish photos, videos and Reels on a schedule", "Publish carousels"],
    cannot: [
      "Post to a personal account",
      "Post Stories",
      "Publish more than roughly 50 posts a day (Instagram's limit, not ours)",
    ],
    consoleUrl: "https://developers.facebook.com/apps",
  },
  {
    id: "facebook",
    name: "Facebook",
    idEnv: "FACEBOOK_APP_ID",
    secretEnv: "FACEBOOK_APP_SECRET",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
    tokenAuth: "body",
    longLived: {
      url: "https://graph.facebook.com/v21.0/oauth/access_token",
      grantType: "fb_exchange_token",
      tokenParam: "fb_exchange_token",
      sendClientId: true,
    },
    prereqs: [
      {
        need: "A Facebook Page you're an admin of — personal profiles can't be posted to by apps",
        steps: [
          "Go to facebook.com → Menu → Pages",
          "Use an existing Page, or Create new Page",
          "Make sure your own account is listed under Page access as an admin",
        ],
      },
    ],
    can: ["Publish text, link and photo posts to your Page on a schedule"],
    cannot: ["Post to your personal profile", "Post to Groups"],
    consoleUrl: "https://developers.facebook.com/apps",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    idEnv: "PINTEREST_APP_ID",
    secretEnv: "PINTEREST_APP_SECRET",
    authorizeUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    scopes: ["boards:read", "pins:read", "pins:write"],
    tokenAuth: "basic",
    prereqs: [
      {
        need: "A Pinterest business account and at least one board to pin to",
        steps: [
          "Pinterest → your profile → Settings → Account management",
          "Choose Convert to business account (free)",
          "Create at least one board — pins need somewhere to land",
        ],
      },
    ],
    can: ["Publish pins with an image to a board you pick", "Schedule pins ahead"],
    cannot: ["Pin without an image", "Post to secret boards"],
    consoleUrl: "https://developers.pinterest.com/apps",
  },
  {
    id: "reddit",
    name: "Reddit",
    idEnv: "REDDIT_APP_ID",
    secretEnv: "REDDIT_APP_SECRET",
    authorizeUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    scopes: ["identity", "submit"],
    // Without this Reddit issues a 1-hour token and no refresh token, which
    // would break every scheduled post more than an hour out.
    extraAuthParams: { duration: "permanent" },
    tokenAuth: "basic",
    prereqs: [
      {
        need: "Nothing — posts go to your own Reddit profile, which every account can post to",
        steps: [
          "Your posts appear on reddit.com/user/yourname, not in a subreddit",
          "Subreddit posting needs a subreddit picker we haven't built yet",
        ],
      },
    ],
    can: ["Submit text posts to your Reddit profile on a schedule"],
    cannot: ["Post into a subreddit (coming when there's somewhere to choose one)", "Bypass a subreddit's karma or age rules"],
    consoleUrl: "https://www.reddit.com/prefs/apps",
  },
];

export function getOAuthProvider(id: string): OAuthProvider | undefined {
  return OAUTH_PROVIDERS.find((p) => p.id === id);
}

/** Credentials present in the environment? Drives the "not set up yet" state. */
export function providerConfigured(p: OAuthProvider): boolean {
  return !!process.env[p.idEnv] && !!process.env[p.secretEnv];
}

/**
 * Ids of every provider whose credentials are present, for the connect UI.
 * Server-side only — reads process.env.
 */
export function configuredProviderIds(): string[] {
  return OAUTH_PROVIDERS.filter(providerConfigured).map((p) => p.id);
}

export function providerCredentials(p: OAuthProvider): { clientId: string; clientSecret: string } | null {
  const clientId = process.env[p.idEnv];
  const clientSecret = process.env[p.secretEnv];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function buildAuthorizeUrl(p: OAuthProvider, clientId: string, redirectUri: string, state: string): string {
  const url = new URL(p.authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", p.scopes.join(","));
  url.searchParams.set("state", state);
  for (const [k, v] of Object.entries(p.extraAuthParams ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

/* ---------------- outcomes ---------------- */

/**
 * Every way connecting can end, including the ones platforms report as a
 * success. `reason` is written to be shown to a creator verbatim.
 */
export type ConnectOutcome =
  | { kind: "ok"; handle: string; accessToken: string; refreshToken: string; expiresAt: string | null }
  | { kind: "error"; code: ConnectErrorCode; reason: string; fix?: string };

export type ConnectErrorCode =
  | "not-configured"
  | "denied"
  | "state-mismatch"
  | "token-failed"
  | "identity-failed"
  | "not-postable"
  | "network";

/**
 * Plain-English copy for every failure. The platform's own message ("Error
 * validating access token: OAuthException 190") is useless to a creator, so
 * nothing raw is ever surfaced — this map is the only thing they see.
 */
export const CONNECT_ERRORS: Record<ConnectErrorCode, { reason: string; fix: string }> = {
  "not-configured": {
    reason: "This platform isn't switched on yet.",
    fix: "Nothing you can do here — we're still finishing our setup with them.",
  },
  denied: {
    reason: "The connection was cancelled before it finished.",
    fix: "Try again, and choose Allow on the platform's permission screen.",
  },
  "state-mismatch": {
    reason: "That connection link had expired.",
    fix: "Start the connection again from this page.",
  },
  "token-failed": {
    reason: "The platform wouldn't complete the connection.",
    fix: "Try once more. If it keeps happening, contact support and we'll look at it.",
  },
  "identity-failed": {
    reason: "We connected, but couldn't read which account it was.",
    fix: "Disconnect and try again — and make sure you pick an account on the permission screen.",
  },
  "not-postable": {
    reason: "Your account is connected, but this platform won't let us post for you yet.",
    fix: "Check the requirements above — an account-type switch is usually all that's missing.",
  },
  network: {
    reason: "We couldn't reach the platform.",
    fix: "This is almost always temporary. Try again in a minute.",
  },
};

export function connectError(code: ConnectErrorCode): { kind: "error"; code: ConnectErrorCode; reason: string; fix: string } {
  return { kind: "error", code, ...CONNECT_ERRORS[code] };
}

/* ---------------- connection health ---------------- */

export type HealthState = "ready" | "expiring" | "expired" | "unknown";

/**
 * Turns a stored expiry into something worth showing. Warning at 7 days is the
 * point: a creator with posts scheduled a fortnight out needs to reconnect
 * before the token dies, not after their posts have already failed.
 */
export function parseExpiry(expiresAt: string): number {
  // SQLite hands back "2026-01-02 03:04:05"; treat a bare timestamp as UTC.
  return Date.parse(/[TZ]/.test(expiresAt) ? expiresAt : `${expiresAt.replace(" ", "T")}Z`);
}

export function connectionHealth(expiresAt: string | null): { state: HealthState; daysLeft: number | null; message: string } {
  if (!expiresAt) return { state: "unknown", daysLeft: null, message: "Connected" };
  const ms = parseExpiry(expiresAt);
  if (Number.isNaN(ms)) return { state: "unknown", daysLeft: null, message: "Connected" };
  const daysLeft = Math.floor((ms - Date.now()) / 86_400_000);
  if (daysLeft < 0) return { state: "expired", daysLeft, message: "Reconnect needed — scheduled posts won't send" };
  if (daysLeft <= 7)
    return {
      state: "expiring",
      daysLeft,
      message: `Reconnect within ${daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}`,
    };
  return { state: "ready", daysLeft, message: "Auto-posting is ready" };
}

/**
 * The one origin OAuth is allowed to happen on.
 *
 * Every provider matches redirect_uri against a fixed list registered in its
 * developer console, character for character. Deriving it from the request's
 * Host header meant the value changed with whichever platform host the creator
 * happened to be browsing — PLATFORM_HOSTS carries the apex, www and sites.*,
 * and the proxy passes all of them through without canonicalising — so
 * starting the flow from www sent a redirect_uri nobody had registered and
 * Meta answered "Invalid redirect_uri".
 *
 * APP_URL is the platform's canonical absolute URL and is already what the
 * registered callbacks are built from, so it is the authority here. The
 * request origin is only a fallback for local development, where APP_URL is
 * typically unset and the registered URI is a localhost one anyway.
 */
export function oauthOrigin(requestOrigin: string): string {
  const configured = (process.env.APP_URL || "").trim().replace(/\/$/, "");
  return configured || requestOrigin;
}

/** The exact redirect_uri for a platform — the same string at both steps. */
export function oauthRedirectUri(requestOrigin: string, platform: string): string {
  return `${oauthOrigin(requestOrigin)}/api/oauth/${platform}/callback`;
}
