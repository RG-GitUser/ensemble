import type { Plan } from "./types";
import { PLANS } from "./plans";

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
    ],
    defaults: {
      heading: "Bonus content",
      items:
        "Behind the scenes | Unreleased footage from the last shoot | https://example.com\nEarly access | New drops 48 hours before everyone else | https://example.com",
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
    ],
    defaults: {
      heading: "Merch",
      items:
        "Logo Tee | $28 | | https://example.com\nSigned Poster | $15 | | https://example.com\nHoodie | $48 | | https://example.com",
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
    ],
    defaults: {
      heading: "The clubhouse",
      body: "Members hang out here. Be kind, share memes, get first looks.",
    },
  },
  {
    type: "live",
    name: "Live Streams",
    description: "Your Twitch, Facebook Live and Instagram Live in one place. Link them in Integrations.",
    requires: null,
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "body", label: "Description", kind: "textarea" },
    ],
    defaults: {
      heading: "Watch me live",
      body: "When I go live, it's right here.",
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
    ],
    defaults: {
      heading: "Get in touch",
      email: "",
      body: "For business inquiries and collabs, drop me a line.",
    },
  },
];

export function getTemplate(type: string): SectionTemplate | undefined {
  return SECTION_TEMPLATES.find((t) => t.type === type);
}

export function planAllowsTemplate(plan: Plan, tpl: SectionTemplate): boolean {
  if (!tpl.requires) return true;
  if (tpl.requires === "pro") return PLANS[plan].payments;
  return plan === "enterprise";
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
