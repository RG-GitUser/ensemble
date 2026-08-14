// Hostname plumbing shared by the proxy, the Caddy "ask" endpoint and the
// settings form. Keep this module dependency-free — proxy.ts imports it and
// must not pull the database (or anything Node-heavy) into its bundle.

/**
 * Hosts that serve the platform itself (marketing site, dashboard, /s/ pages).
 * Any other Host header is treated as a creator's custom domain.
 * In production set PLATFORM_HOSTS, e.g. "ensemble.app,www.ensemble.app".
 */
export function platformHosts(): Set<string> {
  return new Set(
    (process.env.PLATFORM_HOSTS ?? "localhost,127.0.0.1")
      .split(",")
      .map((h) => h.trim().toLowerCase().split(":")[0])
      .filter(Boolean)
  );
}

/**
 * How far along the four-step "your own URL" checklist a site is. The
 * checklist itself lives in DomainSetup; this is the same arithmetic, shared
 * so the summaries on Overview and Settings can't drift from the real thing.
 *
 * Buying the domain (step 1) is counted the moment we know its name — the
 * only evidence we could have that it was bought.
 */
export function domainProgress(o: {
  hostname: string;
  /** True once a request for the hostname has actually reached us. */
  dnsSeen: boolean;
  published: boolean;
}): { done: number; total: number; live: boolean } {
  const named = !!o.hostname;
  const steps = [named, named, o.dnsSeen, o.dnsSeen && o.published];
  return { done: steps.filter(Boolean).length, total: steps.length, live: steps.every(Boolean) };
}

const HOSTNAME_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;

/**
 * Normalize user input to a bare hostname ("https://WWW.JaneDoe.com/about" →
 * "www.janedoe.com"); null if it doesn't look like one.
 */
export function cleanHostname(raw: string): string | null {
  const h = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .split(/[/?#]/)[0]
    .split(":")[0];
  if (h.length > 253 || !HOSTNAME_RE.test(h)) return null;
  return h;
}
