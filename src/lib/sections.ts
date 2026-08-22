import type { Plan } from "./types";
import { PLAN_ORDER } from "./plans";

export interface FieldSpec {
  key: string;
  label: string;
  kind: "text" | "textarea" | "url" | "lines";
  placeholder?: string;
  help?: string;
}

export interface SectionTemplate {
  type: string;
  name: string;
  description: string;
  /** Minimum plan required, or null if available to every plan. */
  requires: "pro" | "enterprise" | null;
  fields: FieldSpec[];
  defaults: Record<string, string>;
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    type: "hero",
    name: "Hero",
    description: "Big headline, tagline and call-to-action at the top of your page.",
    requires: null,
    fields: [
      { key: "heading", label: "Headline", kind: "text", placeholder: "Your name or brand" },
      { key: "subheading", label: "Subheadline", kind: "textarea", placeholder: "What you make and why people love it" },
      { key: "ctaLabel", label: "Button label", kind: "text", placeholder: "Watch my latest" },
      { key: "ctaUrl", label: "Button link", kind: "url", placeholder: "https://..." },
    ],
    defaults: {
      heading: "Hey, I'm your favorite creator",
      subheading: "Videos, music, merch and more — all in one place.",
      ctaLabel: "Check out my content",
      ctaUrl: "#content",
    },
  },
  {
    type: "about",
    name: "About the Creator",
    description: "Tell your audience who you are.",
    requires: null,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "body", label: "Your story", kind: "textarea" },
      { key: "imageUrl", label: "Photo URL (optional)", kind: "url", placeholder: "https://.../photo.jpg" },
    ],
    defaults: {
      heading: "About me",
      body: "I make things on the internet. This is where my community gets the inside track — bonus content, early drops, and merch you can't get anywhere else.",
      imageUrl: "",
    },
  },
  {
    type: "bonus",
    name: "Bonus Content",
    description: "Exclusive drops, behind-the-scenes, early access links.",
    requires: null,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      {
        key: "items",
        label: "Content items",
        kind: "lines",
        help: "One per line: Title | Description | Link",
        placeholder: "Behind the scenes ep. 1 | 20 min unreleased cut | https://...",
      },
      {
        key: "ctaLabel",
        label: "Button label",
        kind: "text",
        help: "Shown on each item. Leave empty for a plain arrow.",
        placeholder: "Open",
      },
    ],
    defaults: {
      heading: "Bonus content",
      items:
        "Behind the scenes | Unreleased footage from the last shoot | https://example.com\nEarly access | New drops 48 hours before everyone else | https://example.com",
      ctaLabel: "",
    },
  },
  {
    type: "video",
    name: "Featured Video",
    description: "Embed a YouTube or Vimeo video.",
    requires: null,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "videoUrl", label: "YouTube / Vimeo URL", kind: "url", placeholder: "https://www.youtube.com/watch?v=..." },
    ],
    defaults: { heading: "Latest video", videoUrl: "" },
  },
  {
    type: "links",
    name: "Link List",
    description: "Link-in-bio style list of your socials and platforms.",
    requires: null,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      {
        key: "items",
        label: "Links",
        kind: "lines",
        help: "One per line: Label | URL",
        placeholder: "YouTube | https://youtube.com/@you",
      },
    ],
    defaults: {
      heading: "Find me everywhere",
      items: "YouTube | https://youtube.com\nInstagram | https://instagram.com\nTikTok | https://tiktok.com",
    },
  },
  {
    type: "merch",
    name: "Merch Store",
    description: "Showcase merchandise. On Pro & Enterprise, paste Stripe payment links to sell directly.",
    requires: null,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      {
        key: "items",
        label: "Products",
        kind: "lines",
        help: "One per line: Name | Price | Image URL | Buy link (Stripe payment link on Pro+)",
        placeholder: "Logo Tee | $28 | https://.../tee.jpg | https://buy.stripe.com/...",
      },
      { key: "buyLabel", label: "Buy button label", kind: "text", placeholder: "Buy now" },
      {
        key: "soonLabel",
        label: "Label when there's no buy link",
        kind: "text",
        help: "Shown in place of the buy button for products without a link.",
        placeholder: "Available soon",
      },
    ],
    defaults: {
      heading: "Merch",
      items:
        "Logo Tee | $28 | | https://example.com\nSigned Poster | $15 | | https://example.com\nHoodie | $48 | | https://example.com",
      buyLabel: "Buy now",
      soonLabel: "Available soon",
    },
  },
  {
    type: "newsletter",
    name: "Newsletter / Membership",
    description: "Collect emails from your followers for newsletters & memberships.",
    requires: "enterprise",
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "body", label: "Pitch", kind: "textarea" },
      { key: "buttonLabel", label: "Button label", kind: "text" },
    ],
    defaults: {
      heading: "Join the inner circle",
      body: "Get the newsletter — drops, stories and member-only perks, straight to your inbox.",
      buttonLabel: "Subscribe",
    },
  },
  {
    type: "calendar",
    name: "Event Calendar",
    description: "Embed a third-party calendar (Calendly, Cal.com) for events or bookings.",
    requires: "enterprise",
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "calendarUrl", label: "Calendly / Cal.com URL", kind: "url", placeholder: "https://calendly.com/you" },
      { key: "body", label: "Description", kind: "textarea" },
    ],
    defaults: {
      heading: "Book time / upcoming events",
      calendarUrl: "",
      body: "Meet & greets, collabs and 1:1s — grab a slot below.",
    },
  },
  {
    type: "chatroom",
    name: "Community Chatroom",
    description: "A custom chatroom space for your followers.",
    requires: "enterprise",
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "body", label: "Welcome message", kind: "textarea" },
      { key: "sendLabel", label: "Send button label", kind: "text", placeholder: "Send" },
    ],
    defaults: {
      heading: "The clubhouse",
      body: "Members hang out here. Be kind, share memes, get first looks.",
      sendLabel: "Send",
    },
  },
  {
    type: "live",
    name: "Live Streams",
    description: "Your Twitch, Facebook Live and Instagram Live in one place. Link them in Integrations.",
    requires: "enterprise",
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "body", label: "Description", kind: "textarea" },
      {
        key: "ctaLabel",
        label: "Instagram button label",
        kind: "text",
        help: "The button shown when an Instagram Live account is linked.",
        placeholder: "Watch my Instagram Live",
      },
    ],
    defaults: {
      heading: "Watch me live",
      body: "When I go live, it's right here.",
      ctaLabel: "Watch my Instagram Live",
    },
  },
  {
    type: "footer",
    name: "Footer",
    description: "Your tagline, privacy policy and terms at the bottom of the page.",
    requires: null,
    fields: [
      {
        key: "tagline",
        label: "Tagline",
        kind: "text",
        help: "The line under everything. Leave empty to use the tagline from Settings.",
        placeholder: "Making things on the internet since 2019",
      },
      {
        key: "privacyUrl",
        label: "Privacy policy link",
        kind: "url",
        help: "Already have one hosted? Link it. Otherwise write it below and we'll show it on your page.",
        placeholder: "https://...",
      },
      {
        key: "privacyText",
        label: "Privacy policy text",
        kind: "textarea",
        help: "Used only when there's no link above. Opens where your visitor is, without leaving your page.",
      },
      { key: "termsUrl", label: "Terms & conditions link", kind: "url", placeholder: "https://..." },
      {
        key: "termsText",
        label: "Terms & conditions text",
        kind: "textarea",
        help: "Used only when there's no link above.",
      },
      {
        key: "copyright",
        label: "Copyright line",
        kind: "text",
        help: "Leave empty to skip it.",
        placeholder: "© 2026 Your Name",
      },
    ],
    defaults: {
      tagline: "",
      privacyUrl: "",
      privacyText:
        "We collect only what we need to run this page: the email address you give us when you subscribe, and anonymous counts of how many people visit. We don't sell your data or pass it to anyone else. Email us and we'll delete anything we hold about you.",
      termsUrl: "",
      termsText:
        "Everything on this page is provided as-is. Products and bonus content are sold and delivered by us, and anything you buy is subject to the terms shown at checkout. We may change what's on this page at any time.",
      copyright: "",
    },
  },
  {
    type: "contact",
    name: "Contact",
    description: "A simple way for fans and brands to reach you.",
    requires: null,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "email", label: "Contact email", kind: "text", placeholder: "you@brand.com" },
      { key: "body", label: "Note", kind: "textarea" },
      {
        key: "buttonLabel",
        label: "Button label",
        kind: "text",
        help: "Leave empty to show your email address on the button.",
        placeholder: "Email me",
      },
    ],
    defaults: {
      heading: "Get in touch",
      email: "",
      body: "For business inquiries and collabs, drop me a line.",
      buttonLabel: "",
    },
  },
];

/**
 * The stacking order "Organize my page" applies: hook first (hero), then the
 * creator's best content (video, bonus, live), commerce while attention is
 * high (merch), the personal story, audience capture (newsletter, calendar),
 * community, and finally the link list and contact where footers belong.
 * Types not listed keep their relative order after everything ranked.
 */
export const RECOMMENDED_ORDER: string[] = [
  "hero",
  "video",
  "bonus",
  "live",
  "merch",
  "about",
  "newsletter",
  "calendar",
  "chatroom",
  "links",
  "contact",
  "footer",
];

export function getTemplate(type: string): SectionTemplate | undefined {
  return SECTION_TEMPLATES.find((t) => t.type === type);
}

/** The sections a brand-new page is seeded with, in the order they are added. */
export const STARTER_SECTIONS = ["hero", "about", "bonus", "links"];

/**
 * What a freshly seeded section holds.
 *
 * Signup seeds a starter page so the builder is never empty, which means
 * "has sections" and "has content" are true for someone who has typed
 * nothing. The setup checklist needs to tell those apart, so it compares
 * against this rather than against a section merely existing. One function,
 * called by both the seeder and the checklist, so the two cannot drift.
 */
export function starterContent(type: string, businessName: string): Record<string, string> {
  const tpl = getTemplate(type);
  if (!tpl) return {};
  return { ...tpl.defaults, ...(type === "hero" ? { heading: businessName } : {}) };
}

/** True while every field in this section still holds what we put there. */
export function isStarterContent(type: string, content: Record<string, string>, businessName: string): boolean {
  const starter = starterContent(type, businessName);
  const keys = Object.keys(starter);
  // A template with no defaults has nothing to have changed away from, so it
  // only counts as written once something is in it.
  if (keys.length === 0) return Object.values(content).every((v) => !v.trim());
  return keys.every((k) => (content[k] ?? "") === starter[k]);
}

export function planAllowsTemplate(plan: Plan, tpl: SectionTemplate): boolean {
  if (!tpl.requires) return true;
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(tpl.requires);
}

/** Parse a "lines" field: each line is pipe-separated values. */
export function parseLines(value: string): string[][] {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split("|").map((p) => p.trim()));
}

/** Convert a YouTube/Vimeo watch URL into an embeddable player URL. */
export function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}
