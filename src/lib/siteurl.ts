import "server-only";

/**
 * Reject URLs that would let a server-side fetch reach private
 * infrastructure (SSRF). Used by the snippet checker, which is the only
 * thing that still fetches a creator's site from our side — content
 * discovery happens in the visitor's browser.
 */
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

  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host);
  // Local addresses stay reachable in dev so a mock site can be checked.
  if (isPrivate && process.env.NODE_ENV === "production") {
    return { error: "That address points at a private network." };
  }
  return { url };
}

/** Fetch a page's HTML, announcing ourselves as a browser. */
export async function fetchPageHtml(url: URL): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.text()).slice(0, 2_000_000);
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
