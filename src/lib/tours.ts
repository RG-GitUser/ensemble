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
        body: "This checklist is the short version of getting live. Work down it and your page is done — each step ticks itself off.",
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
