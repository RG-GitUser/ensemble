/**
 * Install paths for the pairing snippet, one per way a creator actually
 * manages their site.
 *
 * The point is to remove the developer dependency wherever it can be removed.
 * Most hosted platforms have a code-injection box, and Google Tag Manager
 * covers sites whose owner has no file access at all. Only genuinely custom
 * builds are left needing a rebuild — and those are told so up front rather
 * than discovering it after a failed paste.
 */
export interface Installer {
  id: string;
  name: string;
  /** One-line hint under the name in the picker. Keep every tile filled so
      the grid doesn't look ragged. */
  blurb: string;
  /** Small badge on the tile — steers people toward the easiest route. */
  tag?: { label: string; tone: "good" | "warn" };
  /** Ordered click-path the creator follows. */
  steps: string[];
  /** Shown after the steps when there's a common trap. */
  note?: string;
  /** True when the snippet only takes effect after a build/redeploy. */
  needsRebuild?: boolean;
  /** GTM wants the tag pasted without the surrounding advice. */
  gtm?: boolean;
}

export const INSTALLERS: Installer[] = [
  {
    id: "wordpress",
    name: "WordPress",
    blurb: "Self-hosted or wordpress.org",
    steps: [
      "In your WordPress admin, go to Appearance → Theme File Editor, or install the free plugin “WPCode” (easiest, and survives theme updates).",
      "With WPCode: Code Snippets → Add Snippet → Add Your Custom Code, choose “HTML Snippet”.",
      "Paste the line, set Location to “Site Wide Footer”, then Save and Activate.",
    ],
    note: "Don't paste it into a post or page editor — WordPress strips <script> tags from ordinary content.",
  },
  {
    id: "squarespace",
    name: "Squarespace",
    blurb: "Business plan or higher",
    steps: [
      "Settings → Developer Tools → Code Injection.",
      "Paste the line into the Footer box.",
      "Save.",
    ],
    note: "Code Injection needs a Business plan or above. On Personal, use Google Tag Manager instead.",
  },
  {
    id: "wix",
    name: "Wix",
    blurb: "Any Wix plan",
    steps: [
      "Settings → Custom Code (under Advanced).",
      "Add Code → paste the line.",
      "Set “Add Code to Pages” to All pages, and Place Code in “Body – end”.",
      "Apply.",
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    blurb: "Edit your theme's layout file",
    steps: [
      "Online Store → Themes → … → Edit code.",
      "Open Layout → theme.liquid.",
      "Paste the line just above the closing </body> tag, then Save.",
    ],
  },
  {
    id: "webflow",
    name: "Webflow",
    blurb: "Takes effect on publish",
    steps: [
      "Site Settings → Custom Code.",
      "Paste the line into “Footer Code”.",
      "Save, then Publish — custom code only goes live on publish.",
    ],
  },
  {
    id: "gtm",
    name: "Google Tag Manager",
    blurb: "No file access needed",
    tag: { label: "Easiest", tone: "good" },
    gtm: true,
    steps: [
      "In Tag Manager, choose Tags → New → Tag Configuration → Custom HTML.",
      "Paste the line into the HTML box.",
      "Triggering → All Pages.",
      "Save, then hit Submit → Publish.",
    ],
    note: "This is the best route if you can't edit your site's files, or someone else built it. If you're not sure whether you have Tag Manager, search your site's page source for “googletagmanager”.",
  },
  {
    id: "custom",
    name: "Custom-built site",
    blurb: "React, Vue, Vite, Next.js",
    tag: { label: "Needs a deploy", tone: "warn" },
    needsRebuild: true,
    steps: [
      "Add the line to your project's index.html, just before </body>.",
      "Commit it, run your build, and deploy as usual.",
    ],
    note: "Editing the published file isn't enough — your next build overwrites it. If a developer manages your site, send them the line and this instruction; it's a two-minute change for them.",
  },
  {
    id: "other",
    name: "Plain HTML",
    blurb: "cPanel, FTP, a static host",
    steps: [
      "Open the page's .html file (File Manager in cPanel, or your editor).",
      "Paste the line just before the closing </body> tag.",
      "Save and upload.",
    ],
    note: "If your site has more than one page, put it on every page you want to edit — or use Google Tag Manager to cover them all at once.",
  },
];

export function getInstaller(id: string | undefined): Installer | undefined {
  return INSTALLERS.find((i) => i.id === id);
}
