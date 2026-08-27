/**
 * The guided tours that run the first time someone opens each part of the
 * dashboard.
 *
 * A tour is tied to a route and points at real elements: every `target` is a
 * `data-tour` attribute in that page's markup. If a target isn't on the page
 * — a locked feature, an empty state — that step is skipped rather than
 * pointing at nothing, so the same tour works on every plan.
 *
 * Kept as data, away from any component, so adding a bubble is one entry here
 * plus one attribute on the thing it describes.
 */

export interface TourStep {
  /** Value of the data-tour attribute this bubble points at. */
  target: string;
  title: string;
  body: string;
}

export interface TourDef {
  id: string;
  /** Route this runs on. The longest matching prefix wins. */
  path: string;
  steps: TourStep[];
}

export const TOURS: TourDef[] = [
  {
    id: "overview",
    path: "/dashboard",
    steps: [
      {
        target: "setup",
        title: "Start here",
        body: "Six checkpoints between you and a page worth sharing. Work down them in order and each one ticks itself off as you go.",
      },
      {
        target: "publish",
        title: "Live or draft",
        body: "Your page stays private until you publish. You can unpublish any time, and nothing you've built is lost.",
      },
      {
        target: "address",
        title: "Where people find you",
        body: "Every page gets an Ensemble address for free. On Pro and Enterprise you can point your own domain at it instead.",
      },
    ],
  },
  {
    id: "builder",
    path: "/dashboard/builder",
    steps: [
      {
        target: "gallery",
        title: "Build with sections",
        body: "Each block on your page is a section. Add one of each kind you want — the ones already on your page are marked.",
      },
      {
        target: "sections",
        title: "Your content lives here",
        body: "Type into a section and hit save. Drag a section by its title to move it up or down the page.",
      },
      {
        target: "design",
        title: "Make it yours",
        body: "The Design tab has your backdrop, containers, layout and type. Everything there is on every plan.",
      },
    ],
  },
  {
    id: "connect",
    path: "/dashboard/connect",
    steps: [
      {
        target: "snippet",
        title: "Already have a website?",
        body: "Paste one line into it and you can edit its text and pictures from here. Your design stays exactly as it is.",
      },
      {
        target: "domain",
        title: "Your own domain",
        body: "Four short steps, and nothing goes live until every one of them is done.",
      },
    ],
  },
  {
    id: "integrations",
    path: "/dashboard/integrations",
    steps: [
      {
        target: "social-connect",
        title: "Connect your platforms",
        body: "Tap a platform and add your handle. Bluesky and Discord publish for real straight away; the rest light up as Ensemble's platform credentials come online.",
      },
      {
        target: "live-ingest",
        title: "Stream to Ensemble, once",
        body: "Copy this Server and Key into your streaming app — OBS or Streamlabs on desktop, Larix on a phone. One-time setup; after that, every stream is just pressing Start.",
      },
      {
        target: "live-keys",
        title: "Your platform stream keys",
        body: "Each platform gives you a private stream key — Twitch under Creator Dashboard → Settings → Stream, YouTube in Studio → Go live, Facebook in Live Producer. Paste them here once and the relay pushes your stream to every one you filled in. Leave a field blank to skip that platform.",
      },
      {
        target: "live-keys-waiting",
        title: "Stream keys, ready for launch",
        body: "Paste each platform's stream key here — from Twitch's Creator Dashboard, YouTube Studio and Facebook Live Producer. The relay that fans one stream out to all of them switches on soon, and keys saved now are used from its first day.",
      },
      {
        target: "live-page",
        title: "The players on your page",
        body: "These decide what the Live Streams section on your page embeds — your Twitch channel, a Facebook video, your Instagram handle. Separate from the stream keys above, which are about broadcasting.",
      },
      {
        target: "go-live",
        title: "Announcing is yours to press",
        body: "Your page flips to on-air by itself when your stream starts. This button is the megaphone: press it and every connected account gets a post saying where to watch. It never fires on its own, so test streams stay quiet.",
      },
    ],
  },
  {
    id: "settings",
    path: "/dashboard/settings",
    steps: [
      {
        target: "tutorials",
        title: "These tips",
        body: "Turn the tutorial bubbles off here when you're comfortable — and back on whenever you want to see them again.",
      },
      {
        target: "plan",
        title: "Change plan any time",
        body: "Switching plans keeps your content. Sections above a lower plan's limit just come off the live page until you upgrade.",
      },
    ],
  },
];

/** The tour for a route, or null where there isn't one. */
export function tourForPath(path: string): TourDef | null {
  const matches = TOURS.filter((t) => path === t.path || path.startsWith(`${t.path}/`));
  if (matches.length === 0) return null;
  // "/dashboard" prefixes every dashboard route, so the most specific wins.
  return matches.reduce((best, t) => (t.path.length > best.path.length ? t : best));
}
