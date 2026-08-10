/**
 * Server-side half of the OAuth flow: code → token → who is this → can we
 * actually post for them.
 *
 * Kept out of oauth.ts because that module's copy is rendered by the UI, while
 * everything here touches secrets and the network.
 *
 * The endpoint paths and response shapes below are unverified against live
 * apps (no credentials registered yet) — confirm each against the provider's
 * current docs when registering. Every reader is defensive so an unexpected
 * shape degrades to "we couldn't read that" rather than throwing.
 */

import type { OAuthProvider } from "./oauth";

const TIMEOUT = 20_000;

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  /** ISO, or null when the provider issues non-expiring tokens. */
  expiresAt: string | null;
}

export interface Identity {
  handle: string;
  externalId: string;
}

/** Result of asking "will a scheduled post actually go out?" */
export interface Probe {
  postable: boolean;
  /** Creator-facing explanation when postable is false. */
  reason?: string;
}

export async function exchangeCode(
  p: OAuthProvider,
  creds: { clientId: string; clientSecret: string },
  code: string,
  redirectUri: string
): Promise<TokenSet | null> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };

  if (p.tokenAuth === "basic") {
    headers.Authorization = `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", creds.clientId);
    body.set("client_secret", creds.clientSecret);
  }

  const res = await fetch(p.tokenUrl, { method: "POST", headers, body, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as
    | { access_token?: string; refresh_token?: string; expires_in?: number }
    | null;
  if (!json?.access_token) return null;

  const short: TokenSet = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? "",
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null,
  };

  return p.longLived ? ((await upgradeToLongLived(p, creds, short)) ?? short) : short;
}

/**
 * Swap a Meta short-lived (~1 hour) token for a long-lived (~60 day) one.
 *
 * Returns null on failure so the caller can fall back to the short token: a
 * connection that works for an hour beats no connection, and the health check
 * will flag it for reconnection almost immediately.
 */
async function upgradeToLongLived(
  p: OAuthProvider,
  creds: { clientId: string; clientSecret: string },
  short: TokenSet
): Promise<TokenSet | null> {
  const cfg = p.longLived!;
  const url = new URL(cfg.url);
  url.searchParams.set("grant_type", cfg.grantType);
  url.searchParams.set("client_secret", creds.clientSecret);
  url.searchParams.set(cfg.tokenParam, short.accessToken);
  if (cfg.sendClientId) url.searchParams.set("client_id", creds.clientId);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    // Meta omits expires_in on some responses; 60 days is their documented default.
    const secs = json.expires_in ?? 60 * 24 * 3600;
    return {
      accessToken: json.access_token,
      refreshToken: short.refreshToken,
      expiresAt: new Date(Date.now() + secs * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

async function getJson(url: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "Ensemble/1.0" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Who did they just connect, and can we post as them?
 *
 * These two questions are answered together because for most providers the
 * same call settles both — Instagram's `account_type` is the difference
 * between a working integration and a creator wondering why nothing posted.
 */
export async function fetchIdentity(p: OAuthProvider, token: string): Promise<{ identity: Identity; probe: Probe } | null> {
  switch (p.id) {
    case "threads": {
      const me = await getJson("https://graph.threads.net/v1.0/me?fields=id,username", token);
      if (!me) return null;
      return { identity: { handle: str(me.username), externalId: str(me.id) }, probe: { postable: true } };
    }

    case "instagram": {
      const me = await getJson("https://graph.instagram.com/v21.0/me?fields=id,username,account_type", token);
      if (!me) return null;
      const type = str(me.account_type).toUpperCase();
      // Personal accounts authenticate happily and then refuse every publish.
      const postable = type === "BUSINESS" || type === "MEDIA_CREATOR" || type === "CREATOR" || type === "";
      return {
        identity: { handle: str(me.username), externalId: str(me.id) },
        probe: postable
          ? { postable: true }
          : {
              postable: false,
              reason:
                "This is a personal Instagram account, and Instagram only allows scheduled posting from Business or Creator accounts.",
            },
      };
    }

    case "facebook": {
      const me = await getJson("https://graph.facebook.com/v21.0/me/accounts?fields=id,name,tasks", token);
      const pages = Array.isArray(me?.data) ? (me!.data as Array<Record<string, unknown>>) : [];
      if (!me) return null;
      const usable = pages.find((pg) => {
        const tasks = Array.isArray(pg.tasks) ? (pg.tasks as unknown[]).map(str) : [];
        return tasks.length === 0 || tasks.includes("CREATE_CONTENT");
      });
      if (!usable) {
        return {
          identity: { handle: "", externalId: "" },
          probe: {
            postable: false,
            reason:
              "We couldn't find a Facebook Page you can post to. Apps can't post to personal profiles — you'll need a Page you're an admin of.",
          },
        };
      }
      return { identity: { handle: str(usable.name), externalId: str(usable.id) }, probe: { postable: true } };
    }

    case "pinterest": {
      const me = await getJson("https://api.pinterest.com/v5/user_account", token);
      if (!me) return null;
      const boards = await getJson("https://api.pinterest.com/v5/boards?page_size=1", token);
      const hasBoard = Array.isArray(boards?.items) && (boards!.items as unknown[]).length > 0;
      return {
        identity: { handle: str(me.username), externalId: str(me.id) },
        probe: hasBoard
          ? { postable: true }
          : { postable: false, reason: "Your Pinterest account has no boards yet, and every pin needs a board to go to." },
      };
    }

    case "reddit": {
      const me = await getJson("https://oauth.reddit.com/api/v1/me", token);
      if (!me) return null;
      return { identity: { handle: str(me.name), externalId: str(me.id) }, probe: { postable: true } };
    }

    default:
      return null;
  }
}
