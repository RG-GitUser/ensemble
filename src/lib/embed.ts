import "server-only";
import { getSections } from "./db";
import { getPlan } from "./plans";
import { embedUrl, parseLines } from "./sections";
import type { Site } from "./types";

/**
 * The JSON served to external websites via /api/content/[token].
 * Sections are pre-parsed and plan-gated here so embed.js stays dumb and
 * lower tiers can't smuggle locked features through the embed.
 */
export interface EmbedPayload {
  site: { slug: string; tagline: string; themeColor: string };
  canSubscribe: boolean;
  sections: Array<Record<string, unknown> & { type: string }>;
}

export function buildEmbedContent(site: Site): EmbedPayload {
  const plan = getPlan(site.plan);
  const sections = getSections(site.id).flatMap((s): Array<Record<string, unknown> & { type: string }> => {
    const c = s.content;
    switch (s.type) {
      case "hero":
        return [{ type: "hero", heading: c.heading, subheading: c.subheading, ctaLabel: c.ctaLabel, ctaUrl: c.ctaUrl }];
      case "about":
        return [{ type: "about", heading: c.heading, body: c.body, imageUrl: c.imageUrl }];
      case "bonus":
        return [
          {
            type: "bonus",
            heading: c.heading,
            items: parseLines(c.items ?? "").map(([title, desc, url]) => ({ title, desc, url })),
          },
        ];
      case "video":
        return [{ type: "video", heading: c.heading, embedUrl: embedUrl(c.videoUrl ?? "") }];
      case "links":
        return [
          {
            type: "links",
            heading: c.heading,
            items: parseLines(c.items ?? "").map(([label, url]) => ({ label, url })),
          },
        ];
      case "merch":
        return [
          {
            type: "merch",
            heading: c.heading,
            canBuy: plan.payments,
            // Strip buy links server-side on plans without payments — the client
            // flag alone would leave them readable in the raw JSON.
            items: parseLines(c.items ?? "").map(([name, price, img, buyUrl]) => ({
              name,
              price,
              img,
              buyUrl: plan.payments ? buyUrl : "",
            })),
          },
        ];
      case "newsletter":
        return plan.newsletter && site.config.newsletterEnabled !== false
          ? [{ type: "newsletter", heading: c.heading, body: c.body, buttonLabel: c.buttonLabel }]
          : [];
      case "calendar": {
        if (!plan.calendar) return [];
        const url = c.calendarUrl || site.config.calendlyUrl || "";
        return url ? [{ type: "calendar", heading: c.heading, body: c.body, url }] : [];
      }
      case "live": {
        const { twitchChannel, facebookLiveUrl, instagramLiveUser } = site.config;
        if (!twitchChannel && !facebookLiveUrl && !instagramLiveUser) return [];
        return [
          {
            type: "live",
            heading: c.heading,
            body: c.body,
            // Raw values — embed.js builds the player URLs (Twitch needs the
            // embedding page's own hostname as `parent`).
            twitchChannel: twitchChannel ?? "",
            facebookLiveUrl: facebookLiveUrl ?? "",
            instagramLiveUser: instagramLiveUser ?? "",
          },
        ];
      }
      case "contact":
        return [{ type: "contact", heading: c.heading, email: c.email, body: c.body }];
      default:
        // Chatroom stays on the hosted page — it needs our server for posting.
        return [];
    }
  });

  return {
    site: { slug: site.slug, tagline: site.config.tagline, themeColor: site.config.themeColor },
    canSubscribe: plan.newsletter,
    sections,
  };
}
