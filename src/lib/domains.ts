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
