import "server-only";
import { parse, HTMLElement } from "node-html-parser";
import type { ContentKind } from "./types";

export interface ScrapedItem {
  selector: string;
  kind: ContentKind;
  original: string;
  position: number;
}

/** Tags whose text a creator can edit. Nested ones prefer the innermost match. */
const TEXT_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "figcaption"]);
const SKIP_SUBTREES = new Set(["script", "style", "noscript", "template", "svg"]);
const MAX_ITEMS = 300;

/** Reject URLs that would let a scan reach private infrastructure (SSRF). */
export function validateSiteUrl(raw: string): { url: URL } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return { error: "That doesn't look like a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { error: "Only http(s) websites can be connected." };

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
  // Local addresses stay reachable in dev so the mock site can be scanned.
  if (isPrivate && process.env.NODE_ENV === "production") {
    return { error: "That address points at a private network and can't be connected." };
  }
  return { url };
}

export async function fetchSiteHtml(url: URL): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: {
        // Shared-host firewalls (ModSecurity et al.) often reject anything that
        // doesn't look like a browser, so announce ourselves as one.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause?.code ?? "";
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error("The site took too long to respond (15s). Try again, or check the address.");
    }
    if (cause === "ENOTFOUND" || cause === "EAI_AGAIN") {
      throw new Error("Couldn't find that domain — double-check the spelling (e.g. https://www.yoursite.com).");
    }
    if (cause === "ECONNREFUSED") {
      throw new Error("The domain exists but nothing answered there. Is the site online?");
    }
    if (cause.startsWith("ERR_TLS") || cause === "CERT_HAS_EXPIRED" || cause === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
      throw new Error("The site's HTTPS certificate couldn't be verified. Try the http:// address.");
    }
    throw new Error(`Couldn't reach that website${cause ? ` (${cause})` : ""}. Check the address and try again.`);
  }
  if (res.status === 403 || res.status === 406) {
    throw new Error(
      `The site's firewall blocked the scan (HTTP ${res.status}). If your host runs ModSecurity/bot protection, allowlist your own IP or try again in a minute.`
    );
  }
  if (!res.ok) throw new Error(`The site responded with HTTP ${res.status}.`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("text/html") && !type.includes("xhtml")) {
    throw new Error(`That URL serves "${type.split(";")[0] || "unknown content"}", not an HTML page.`);
  }
  const text = await res.text();
  return text.slice(0, 2_000_000);
}

/** CSS path from body down, e.g. "body > div:nth-of-type(2) > p:nth-of-type(3)". */
function cssPath(el: HTMLElement): string {
  const segments: string[] = [];
  let node: HTMLElement | null = el;
  while (node && node.tagName && node.tagName.toLowerCase() !== "body" && node.tagName.toLowerCase() !== "html") {
    const tag = node.tagName.toLowerCase();
    const parent: HTMLElement | null = node.parentNode as HTMLElement | null;
    let nth = 1;
    if (parent) {
      for (const sibling of parent.childNodes) {
        if (sibling === node) break;
        if (sibling instanceof HTMLElement && sibling.tagName?.toLowerCase() === tag) nth++;
      }
    }
    segments.unshift(`${tag}:nth-of-type(${nth})`);
    node = parent;
  }
  return "body > " + segments.join(" > ");
}

function absolutize(src: string, base: URL): string {
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}

/** Walk the document and pull out everything a creator should be able to edit. */
export function extractContent(html: string, base: URL): ScrapedItem[] {
  const root = parse(html, { blockTextElements: { script: false, style: false, noscript: false } });
  const body = root.querySelector("body") ?? root;
  const items: ScrapedItem[] = [];
  const seenSelectors = new Set<string>();

  const push = (el: HTMLElement, kind: ContentKind, original: string) => {
    if (items.length >= MAX_ITEMS) return;
    const selector = cssPath(el);
    if (seenSelectors.has(selector)) return;
    seenSelectors.add(selector);
    items.push({ selector, kind, original, position: items.length + 1 });
  };

  const walk = (el: HTMLElement): void => {
    const tag = el.tagName?.toLowerCase() ?? "";
    if (SKIP_SUBTREES.has(tag)) return;

    if (tag === "img") {
      const src = el.getAttribute("src");
      if (src && !src.startsWith("data:")) push(el, "image", absolutize(src, base));
      return;
    }
    if (tag === "iframe") {
      const src = el.getAttribute("src");
      if (src) push(el, "video", absolutize(src, base));
      return;
    }
    if (tag === "video") {
      const src = el.getAttribute("src") ?? el.querySelector("source")?.getAttribute("src");
      if (src) push(el, "video", absolutize(src, base));
      return;
    }

    if (TEXT_TAGS.has(tag)) {
      // Prefer the innermost editable block (li > p edits the p, not the li).
      const hasNestedTextTag = el.querySelectorAll(Array.from(TEXT_TAGS).join(",")).length > 0;
      if (!hasNestedTextTag) {
        const text = el.text.replace(/\s+/g, " ").trim();
        if (text) push(el, "text", text);
        // Images inside a text block are still editable on their own.
      }
      if (!hasNestedTextTag) {
        for (const child of el.querySelectorAll("img")) {
          const src = child.getAttribute("src");
          if (src && !src.startsWith("data:")) push(child, "image", absolutize(src, base));
        }
        return;
      }
    }

    for (const child of el.childNodes) {
      if (child instanceof HTMLElement) walk(child);
    }
  };

  walk(body as HTMLElement);
  return items;
}
