import "server-only";
import net from "net";
import { lookup } from "dns/promises";

/**
 * Reject URLs that would let a server-side fetch reach private
 * infrastructure (SSRF). Used by the snippet checker, which is the only
 * thing that still fetches a creator's site from our side — content
 * discovery happens in the visitor's browser.
 *
 * The old guard was a regex over `url.hostname` and nothing else, which left
 * two working bypasses:
 *
 *   1. A public DNS name that RESOLVES to a private address. The string looked
 *      fine, so nothing stopped the connection.
 *   2. Simpler still, any URL that 302s to http://169.254.169.254/ or back
 *      into http://127.0.0.1:3000 — the check ran once, before a fetch that
 *      followed redirects on its own.
 *
 * The payoff was not theoretical: redirecting to
 * 127.0.0.1:3000/api/domains/check?domain=… turns "check my website" into a
 * customer-enumeration oracle against the one endpoint the Caddyfile blocks at
 * the edge, bypassed because this fetch originates INSIDE the droplet.
 *
 * So: resolve the name, check every address it resolves to, and re-run the
 * whole check on each redirect hop rather than trusting the first one.
 *
 * Residual risk worth naming: a name that resolves to a public address here
 * and a private one when the socket is opened (DNS rebinding) is not closed by
 * this, because fetch gives no way to pin the connection to the address we
 * vetted. Closing it needs a custom dispatcher; the window is small and every
 * hop is re-checked, which is what makes the practical attacks above fail.
 */
const PRIVATE_ADDRESS_ERROR = "That address points at a private network.";

/** True for anything not safe to open a connection to from inside the droplet. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || // "this network"
      a === 10 || // RFC1918
      a === 127 || // loopback
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local, incl. cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // RFC1918
      (a === 192 && b === 0) || // IETF protocol assignments + TEST-NET-1
      (a === 192 && b === 168) || // RFC1918
      (a === 198 && (b === 18 || b === 19)) || // benchmarking
      (a === 198 && b === 51) || // TEST-NET-2
      (a === 203 && b === 0) || // TEST-NET-3
      a >= 224 // multicast, reserved, broadcast
    );
  }
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    if (s === "::" || s === "::1") return true;
    // IPv4-mapped and IPv4-compatible forms smuggle a v4 address through.
    const mapped = s.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (/^f[cd]/.test(s)) return true; // fc00::/7 unique local
    if (/^fe[89ab]/.test(s)) return true; // fe80::/10 link-local
    if (/^ff/.test(s)) return true; // ff00::/8 multicast
    return false;
  }
  // Not a parseable address — including decimal and hex integer forms of an
  // IPv4 address, which URL leaves alone and the old regex never matched.
  return true;
}

export function validateSiteUrl(raw: string): { url: URL } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return { error: "That doesn't look like a web address." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "Only http(s) websites can be checked." };
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return { error: "That doesn't look like a web address." };

  const suspiciousName =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa");
  if (suspiciousName && process.env.NODE_ENV === "production") {
    return { error: PRIVATE_ADDRESS_ERROR };
  }
  if (net.isIP(host) && isPrivateAddress(host) && process.env.NODE_ENV === "production") {
    return { error: PRIVATE_ADDRESS_ERROR };
  }
  return { url };
}

/**
 * Resolve a URL's host and refuse it if ANY address it answers with is
 * private. Every address, because a name with both a public and a private A
 * record is the whole trick.
 */
async function checkResolvesPublic(url: URL): Promise<{ ok: true } | { error: string }> {
  // Local addresses stay reachable in dev so a mock site can be checked.
  if (process.env.NODE_ENV !== "production") return { ok: true };

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    return isPrivateAddress(host) ? { error: PRIVATE_ADDRESS_ERROR } : { ok: true };
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return { error: "That address couldn't be looked up." };
  }
  if (addresses.length === 0) return { error: "That address couldn't be looked up." };
  for (const a of addresses) {
    if (isPrivateAddress(a.address)) return { error: PRIVATE_ADDRESS_ERROR };
  }
  return { ok: true };
}

/** Raised for a URL we refuse to open. The message is safe to show a creator. */
export class UnsafeUrlError extends Error {}

const MAX_REDIRECTS = 5;

/**
 * Fetch a page's HTML, announcing ourselves as a browser.
 *
 * Redirects are followed BY HAND so each hop goes through the same protocol,
 * hostname and DNS checks as the URL the creator typed.
 */
export async function fetchPageHtml(url: URL): Promise<string> {
  let current = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new UnsafeUrlError("That site redirected somewhere we can't follow.");
    }
    const validated = validateSiteUrl(current.href);
    if ("error" in validated) throw new UnsafeUrlError(validated.error);
    const resolved = await checkResolvesPublic(current);
    if ("error" in resolved) throw new UnsafeUrlError(resolved.error);

    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`HTTP ${res.status}`);
      current = new URL(location, current);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.text()).slice(0, 2_000_000);
  }
  throw new UnsafeUrlError("That site redirected too many times.");
}

export interface SnippetCheck {
  /** Machine-readable verdict; the UI turns this into plain English. */
  status: "ok" | "missing" | "wrong-origin" | "wrong-token" | "unreachable";
  /** The src we found on their page, when there was one. */
  foundSrc?: string;
  /** Their page renders client-side, so the snippet must go in the source. */
  spa?: boolean;
  detail?: string;
}

/**
 * Decide why a creator's site isn't paired, from its HTML alone.
 *
 * This only looks for one string, so unlike the old content scan it degrades
 * gracefully: a firewall block or a JS-rendered page costs us the check, not
 * the feature.
 */
export function inspectSnippet(html: string, expectedOrigin: string, expectedToken: string): SnippetCheck {
  // A client-rendered shell: <body> holds a mount point and script tags, and
  // essentially no text. Those need the snippet in the *source* index.html.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : "";
  const bodyText = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
  const spa = bodyText.length < 120 && /<div[^>]+id=["'](root|app|__next)["']/i.test(body);

  const tag = (html.match(/<script[^>]*connect\.js[^>]*>/i) ?? [])[0];
  if (!tag) return { status: "missing", spa };

  const src = (tag.match(/src=["']([^"']+)["']/i) ?? [])[1] ?? "";
  const token = (tag.match(/data-site=["']([^"']+)["']/i) ?? [])[1] ?? "";

  let srcOrigin = "";
  try {
    srcOrigin = new URL(src).origin;
  } catch {
    /* relative or malformed src */
  }
  if (srcOrigin !== expectedOrigin) return { status: "wrong-origin", foundSrc: src, spa };
  if (token !== expectedToken) return { status: "wrong-token", foundSrc: src, spa };
  return { status: "ok", foundSrc: src, spa };
}
