// Client-safe registry of connectable social platforms. Icons come from
// simple-icons (official brand marks + colors). LinkedIn is absent from the
// library for brand-policy reasons, so it's not offered here.
import {
  siBluesky,
  siDiscord,
  siFacebook,
  siInstagram,
  siPinterest,
  siReddit,
  siSnapchat,
  siThreads,
  siTiktok,
  siTwitch,
  siX,
  siYoutube,
} from "simple-icons";

export interface PlatformDef {
  id: string;
  name: string;
  /** SVG path (24x24 viewBox) of the official brand mark. */
  iconPath: string;
  /** Official brand color, "#RRGGBB". */
  color: string;
  placeholder: string;
  /** Public profile URL for a connected handle. */
  profileUrl: (handle: string) => string;
  /**
   * How connecting works: "handle" stores a name only; "bluesky" takes handle +
   * app password (publishes for real); "webhook" takes a webhook URL (publishes
   * for real); "oauth" uses a one-click platform login when Ensemble has app
   * credentials, falling back to handle-only until then.
   */
  authType: "handle" | "bluesky" | "webhook" | "oauth";
}

/** Most popular platforms first — this order drives the connect grid. */
export const PLATFORMS: PlatformDef[] = [
  { id: "instagram", name: "Instagram", iconPath: siInstagram.path, color: `#${siInstagram.hex}`, placeholder: "yourhandle", profileUrl: (h) => `https://instagram.com/${h}`, authType: "oauth" },
  // TikTok has no OAUTH_PROVIDERS entry yet (its content API needs video
  // uploads and an audited app), so it stays handle-only until one is added.
  { id: "tiktok", name: "TikTok", iconPath: siTiktok.path, color: `#${siTiktok.hex}`, placeholder: "yourhandle", profileUrl: (h) => `https://tiktok.com/@${h}`, authType: "oauth" },
  { id: "youtube", name: "YouTube", iconPath: siYoutube.path, color: `#${siYoutube.hex}`, placeholder: "yourchannel", profileUrl: (h) => `https://youtube.com/@${h}`, authType: "handle" },
  { id: "x", name: "X", iconPath: siX.path, color: `#${siX.hex}`, placeholder: "yourhandle", profileUrl: (h) => `https://x.com/${h}`, authType: "handle" },
  { id: "facebook", name: "Facebook", iconPath: siFacebook.path, color: `#${siFacebook.hex}`, placeholder: "yourpage", profileUrl: (h) => `https://facebook.com/${h}`, authType: "oauth" },
  { id: "twitch", name: "Twitch", iconPath: siTwitch.path, color: `#${siTwitch.hex}`, placeholder: "yourchannel", profileUrl: (h) => `https://twitch.tv/${h}`, authType: "handle" },
  { id: "threads", name: "Threads", iconPath: siThreads.path, color: `#${siThreads.hex}`, placeholder: "yourhandle", profileUrl: (h) => `https://threads.net/@${h}`, authType: "oauth" },
  { id: "snapchat", name: "Snapchat", iconPath: siSnapchat.path, color: `#${siSnapchat.hex}`, placeholder: "yourhandle", profileUrl: (h) => `https://snapchat.com/add/${h}`, authType: "handle" },
  { id: "discord", name: "Discord", iconPath: siDiscord.path, color: `#${siDiscord.hex}`, placeholder: "webhook URL", profileUrl: (h) => `https://discord.gg/${h}`, authType: "webhook" },
  { id: "pinterest", name: "Pinterest", iconPath: siPinterest.path, color: `#${siPinterest.hex}`, placeholder: "yourhandle", profileUrl: (h) => `https://pinterest.com/${h}`, authType: "oauth" },
  { id: "reddit", name: "Reddit", iconPath: siReddit.path, color: `#${siReddit.hex}`, placeholder: "u/yourname", profileUrl: (h) => `https://reddit.com/user/${h.replace(/^u\//, "")}`, authType: "oauth" },
  { id: "bluesky", name: "Bluesky", iconPath: siBluesky.path, color: `#${siBluesky.hex}`, placeholder: "you.bsky.social", profileUrl: (h) => `https://bsky.app/profile/${h}`, authType: "bluesky" },
];

/** Discord incoming-webhook URLs are the only accepted webhook targets. */
export function isDiscordWebhook(url: string): boolean {
  return /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url.trim());
}

export function getPlatform(id: string): PlatformDef | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

/**
 * Brand marks that are near-black vanish against the dark UI, so they borrow
 * the foreground colour instead of their own. This returns the token rather
 * than a hex: the light theme flips --color-snow to near-black, which is how
 * these marks are meant to sit on a white card anyway, and a var resolves at
 * paint time — so Server Components, which can't know the active theme, get
 * it right too.
 */
export function iconFill(color: string): string {
  const n = parseInt(color.slice(1), 16);
  const luminance = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luminance < 40 ? "var(--color-snow)" : color;
}

/**
 * A follower count the way people actually type one: "10000", "10,000",
 * "10 000", "10k", "1.2m", "50K". Returns a whole number, or NaN when the
 * text doesn't read as a count.
 */
export function parseCount(raw: string): number {
  const t = raw.trim().toLowerCase().replace(/[\s,]/g, "");
  const m = /^(\d+(?:\.\d+)?)([km]?)$/.exec(t);
  if (!m) return NaN;
  const mult = m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1;
  return Math.round(parseFloat(m[1]) * mult);
}

/** Compact count for headlines: 950 → "950", 12_340 → "12.3k", 1_200_000 → "1.2m". */
export function formatCount(n: number): string {
  const compact = (v: number, suffix: string) => {
    const s = v >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString();
    return `${s}${suffix}`;
  };
  if (n >= 1_000_000) return compact(n / 1_000_000, "m");
  if (n >= 1_000) return compact(n / 1_000, "k");
  return n.toString();
}

/** "@name", a pasted profile URL (with or without https://), or plain handle → bare handle. */
export function cleanHandle(raw: string): string {
  let h = raw.trim().replace(/^@/, "");
  try {
    if (/^https?:\/\//i.test(h)) {
      h = new URL(h).pathname.split("/").filter(Boolean).pop() ?? "";
    } else if (h.includes("/")) {
      // "twitch.tv/name" or "site.com/name/" pasted without a protocol.
      h = h.split("/").filter(Boolean).pop() ?? "";
    }
    h = h.replace(/^@/, "").split("?")[0];
  } catch {}
  return h.slice(0, 64);
}

/** Twitch channel from a bare name or twitch.tv URL; strict charset for embed safety. */
export function cleanTwitchChannel(raw: string): string {
  const h = cleanHandle(raw).toLowerCase();
  return /^[a-z0-9_]{3,25}$/.test(h) ? h : "";
}

/** Instagram username, strict charset for URL safety. */
export function cleanInstagramUser(raw: string): string {
  const h = cleanHandle(raw).toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : "";
}

/** Only real facebook.com video/live URLs are allowed into the embed iframe. */
export function cleanFacebookLiveUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    const u = new URL(t);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== "https:") return "";
    if (host !== "facebook.com" && host !== "www.facebook.com" && host !== "fb.watch") return "";
    return u.href;
  } catch {
    return "";
  }
}
