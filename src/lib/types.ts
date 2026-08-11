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
  /** Uploaded or generated background image URL (/api/uploads/...). */
  bgImage?: string;
  /** Uploaded container/card background image URL. */
  cardImage?: string;
  /** Browser tab icon for the public page (/api/uploads/...). */
  faviconUrl?: string;
  /** Accent glow gradient at the top of the page (default on). */
  gradient?: boolean;
  tagline: string;
  /** Site-wide visual theme id from lib/themes.ts ("" = classic midnight). */
  themeId?: string;
  stripeKey?: string;
  /** Creator's own Stripe key for the Finance tab (restricted key advised). */
  financeStripeKey?: string;
  /** QuickBooks company shown as connected on the Finance tab. */
  quickbooksCompany?: string;
  calendlyUrl?: string;
  chatroomEnabled?: boolean;
  newsletterEnabled?: boolean;
  /** Live stream sources shown by the Live Streams section. */
  twitchChannel?: string;
  facebookLiveUrl?: string;
  instagramLiveUser?: string;
  /** Per-platform RTMP stream keys for simulcast fan-out (stored for the relay). */
  twitchStreamKey?: string;
  facebookStreamKey?: string;
  instagramStreamKey?: string;
  /** Creator hit Go Live — the Live section shows the on-air state. */
  liveNow?: boolean;
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
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  siteId: number;
  author: string;
  body: string;
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
