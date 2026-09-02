export type Plan = "basic" | "pro" | "enterprise";
export type SetupPath = "scratch" | "integrate";

export interface User {
  id: number;
  email: string;
  name: string;
  businessName: string;
  createdAt: string;
}

export interface SiteConfig {
  themeColor: string;
  /** Page background color (curated palette — see lib/theme.ts). */
  bgColor?: string;
  /** Container/card background on the public page (curated palette). */
  cardColor?: string;
  /** Container width multiplier, free between SIZE_MIN and SIZE_MAX (lib/theme.ts). */
  containerSize?: string;
  /** Floor under every container, in rem. "0" is none — content decides. */
  containerMinHeight?: string;
  /** Container border treatment — a BORDER_STYLES id from lib/theme.ts. */
  borderStyle?: string;
  /** Uploaded or generated background image URL (/api/uploads/...). */
  bgImage?: string;
  /** Uploaded container/card background image URL. */
  cardImage?: string;
  /** Browser tab icon for the public page (/api/uploads/...). */
  faviconUrl?: string;
  /** Accent glow gradient at the top of the page (default on). */
  gradient?: boolean;
  /** How strong that glow is — a GLOWS id from lib/theme.ts. */
  glowStrength?: string;
  /** How far the glow spreads — a GLOW_SIZES id from lib/theme.ts. */
  glowSize?: string;
  /** Glow colour. "" follows the accent, which is the historic behaviour. */
  glowColor?: string;
  /** How the accent paints buttons — a BUTTON_STYLES id from lib/theme.ts. */
  buttonStyle?: string;
  tagline: string;
  /** Site-wide visual theme id from lib/themes.ts ("" = classic midnight). */
  themeId?: string;
  /** Typeface id from lib/fonts.ts ("" = Geist). */
  fontId?: string;
  /** Text size multiplier — a TEXT_SIZES value from lib/fonts.ts. */
  fontScale?: string;
  /** Page text color (palette or a custom hex; defaults to white). */
  textColor?: string;
  /** How sections are arranged — a LAYOUTS id from lib/theme.ts. */
  layout?: string;
  /**
   * The storefront layout's profile panel. Only the portrait is required for
   * the panel to be worth showing; the rest fall back to the account's own
   * details, so a creator gets something sensible before touching any of it.
   */
  profileImage?: string;
  /** Frame treatment around the portrait — a FRAMES id from lib/theme.ts. */
  profileFrame?: string;
  /** Shown under the name, e.g. "@yourhandle". */
  profileHandle?: string;
  /** A short line under the handle, e.g. where they are. */
  profileLocation?: string;
  /** Vertical air between sections — a SPACINGS id from lib/theme.ts. */
  sectionSpacing?: string;
  /** Corner roundness of containers and buttons — a CORNERS id from lib/theme.ts. */
  cornerStyle?: string;
  /**
   * Whether the public page offers light, dark, or lets the visitor choose.
   * Absent = "dark", so every page that predates this setting is untouched.
   */
  colorMode?: "dark" | "light" | "auto";
  /** Light-mode counterparts. Each falls back to a shipped light default. */
  lightBgColor?: string;
  lightCardColor?: string;
  lightTextColor?: string;
  lightThemeId?: string;
  stripeKey?: string;
  /** Creator's own Stripe key for the Finance tab (restricted key advised). */
  financeStripeKey?: string;
  /** QuickBooks company shown as connected on the Finance tab. */
  quickbooksCompany?: string;
  calendlyUrl?: string;
  /**
   * The creator's own email platform (EMAIL_PROVIDERS in lib/email-providers).
   * Signups are still stored locally; this forwards a copy to the list they
   * already run, so Ensemble adds to their audience rather than fencing it.
   */
  emailProvider?: string;
  emailApiKey?: string;
  /** List, form or publication id, depending on the provider. */
  emailListId?: string;
  chatroomEnabled?: boolean;
  newsletterEnabled?: boolean;
  /** Live stream sources shown by the Live Streams section. */
  twitchChannel?: string;
  facebookLiveUrl?: string;
  instagramLiveUser?: string;
  /**
   * Per-platform RTMP stream keys, spent by the live relay: stream once to
   * Ensemble's ingest and these decide where the relay pushes it on.
   * Instagram's key is stored but not pushed to — there is no official
   * third-party ingest for Instagram Live.
   */
  twitchStreamKey?: string;
  youtubeStreamKey?: string;
  facebookStreamKey?: string;
  instagramStreamKey?: string;
  /** Creator hit Go Live — the Live section shows the on-air state. */
  liveNow?: boolean;
  /** Named design snapshots the creator can switch between. */
  looks?: SavedLook[];
}

/**
 * The slice of SiteConfig the Design tab owns. A saved look stores exactly
 * this and nothing else, so applying one can never disturb sections,
 * integrations or billing.
 */
export type DesignConfig = Pick<
  SiteConfig,
  | "themeColor"
  | "bgColor"
  | "cardColor"
  | "containerSize"
  | "containerMinHeight"
  | "borderStyle"
  | "bgImage"
  | "cardImage"
  | "gradient"
  | "themeId"
  | "fontId"
  | "fontScale"
  | "textColor"
  | "layout"
  | "sectionSpacing"
  | "cornerStyle"
  | "colorMode"
  | "lightBgColor"
  | "lightCardColor"
  | "lightTextColor"
  | "lightThemeId"
>;

export interface SavedLook {
  id: string;
  name: string;
  design: DesignConfig;
}

export interface Site {
  id: number;
  userId: number;
  slug: string;
  plan: Plan;
  published: boolean;
  config: SiteConfig;
  /** Public token external websites use to pull this site's content via the embed. */
  embedToken: string;
  /** Secret RTMP key the creator streams to the live relay with. */
  ingestKey: string;
  /** Stripe billing state — empty strings until billing is set up. */
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  /** "" (preview mode) | "unpaid" | "active" | "past_due" | "canceled" */
  billingStatus: string;
  /** Unix seconds of the newest applied Stripe event (ordering guard). */
  billingEventAt: number;
  createdAt: string;
}

export interface Section {
  id: number;
  siteId: number;
  type: string;
  position: number;
  content: Record<string, string>;
  /** Visual theme id from lib/themes.ts, or "" to inherit the page theme. */
  theme: string;
  /** Which way this section's copy runs — a TEXT_ALIGNS value, or "" for centred. */
  align: string;
  /** Where this section's buttons sit — a TEXT_ALIGNS value, or "" for centred. */
  buttonAlign: string;
}

export interface QuoteRequest {
  id: number;
  userId: number;
  name: string;
  businessName: string;
  email: string;
  websiteUrl: string;
  details: string;
  /** Platform the site runs on (see QUOTE_PLATFORMS). */
  platform: string;
  /** How the creator will give us access (see QUOTE_ACCESS_METHODS). */
  accessMethod: string;
  /** Stored name of an uploaded project zip in data/uploads, or "". */
  fileName: string;
  status: "new" | "quoted" | "closed";
  createdAt: string;
}

export interface Lead {
  id: number;
  siteId: number;
  email: string;
  /** Secret carried by the unsubscribe link in every email. */
  unsubToken: string;
  /** When they opted out, or null while they're still subscribed. */
  unsubscribedAt: string | null;
  createdAt: string;
}

/** One newsletter actually sent — the Audience tab's history. */
export interface NewsletterPost {
  id: number;
  siteId: number;
  subject: string;
  body: string;
  recipients: number;
  sentAt: string;
}

export interface ChatMessage {
  id: number;
  siteId: number;
  author: string;
  body: string;
  /** Posted by the site owner from the dashboard — rooms show a badge. */
  isCreator: boolean;
  createdAt: string;
}

export type TicketStatus = "open" | "answered" | "closed";

export interface SupportTicket {
  id: number;
  userId: number;
  subject: string;
  body: string;
  status: TicketStatus;
  reply: string;
  createdAt: string;
}

export interface DailyViews {
  day: string;
  views: number;
}

/** A creator's existing website paired with the dashboard. */
export interface Connection {
  siteId: number;
  url: string;
  enabled: boolean;
  /** Last time the snippet reported its page contents. */
  lastScraped: string | null;
  /** Last time the pasted snippet phoned home, and from which host. */
  lastSeen: string | null;
  seenHost: string;
  /** True while we want the snippet to re-report the page's contents. */
  needsReport: boolean;
}

/** A creator-owned domain serving their hosted page. */
export interface CustomDomain {
  /** Value the creator publishes in a TXT record to prove the domain is theirs. */
  verifyToken: string;
  /** When ownership was proved; null while the claim is unproven. */
  verifiedAt: string | null;
  siteId: number;
  hostname: string;
  createdAt: string;
  /** Last time a request for this hostname actually reached us — null until DNS works. */
  lastSeen: string | null;
}

export type ContentKind = "text" | "image" | "video";

/** One editable piece of content extracted from the paired website. */
export interface ContentItem {
  id: number;
  siteId: number;
  /** CSS path used to find the element again on the live site. */
  selector: string;
  kind: ContentKind;
  /** What the element contained when the site was scanned. */
  original: string;
  /** The creator's replacement, or null if untouched. */
  edited: string | null;
  position: number;
}

export interface ReferrerViews {
  referrer: string;
  views: number;
}

export type SocialAuthKind = "handle" | "bluesky" | "webhook" | "oauth";

/** A social platform account the creator connected to their dashboard (no credentials). */
/** One dated follower reading for a single platform. */
export interface FollowerSnapshot {
  platform: string;
  /** YYYY-MM-DD — the date the count describes, not when it was typed in. */
  day: string;
  count: number;
  /** "manual" today; a platform id once APIs write these rows. */
  source: string;
}

/**
 * A follower count as it stood on a requested date. `measuredOn` is the day
 * the reading was actually taken, which is on or before the date asked about
 * — the two differ whenever nothing was recorded on the date itself.
 */
export interface FollowerReading {
  platform: string;
  count: number;
  measuredOn: string;
  source: string;
}

export interface SocialAccount {
  id: number;
  siteId: number;
  platform: string;
  handle: string;
  authKind: SocialAuthKind;
  createdAt: string;
}

/** Full credentials row — server-side publishing only, never sent to the client. */
export interface SocialAccountAuth {
  platform: string;
  handle: string;
  authKind: SocialAuthKind;
  secret: string;
  refreshToken: string;
  expiresAt: string | null;
  externalId: string;
}

/** A follower/subscriber count for one platform, true on one date. */
export interface SocialStat {
  id: number;
  siteId: number;
  platform: string;
  /** Which number this is — a METRICS id from lib/social.ts. */
  metric: string;
  /** The date the count was observed, "YYYY-MM-DD". */
  day: string;
  count: number;
  /** Optional context — "hit by the algorithm", "collab with X", etc. */
  note: string;
  createdAt: string;
}

export type PostTargetStatus = "queued" | "posted" | "failed";

export interface SocialPostTarget {
  platform: string;
  status: PostTargetStatus;
  /** Post URL when posted; error or waiting reason otherwise. */
  detail: string;
}

/** One composed post, fanned out to the selected platforms. */
export interface SocialPost {
  id: number;
  siteId: number;
  body: string;
  mediaUrl: string;
  createdAt: string;
  targets: SocialPostTarget[];
}
