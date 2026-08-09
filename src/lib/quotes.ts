// Client-safe option lists for the "Integrate a Current Website" request flow.

export const QUOTE_PLATFORMS = [
  { id: "wordpress", label: "WordPress" },
  { id: "squarespace", label: "Squarespace" },
  { id: "wix", label: "Wix" },
  { id: "shopify", label: "Shopify" },
  { id: "static", label: "Custom / static HTML" },
  { id: "other", label: "Something else / not sure" },
] as const;

export const QUOTE_ACCESS_METHODS = [
  {
    id: "invite",
    label: "Invite Ensemble as an editor / collaborator",
    hint: "The usual way for WordPress, Squarespace, Wix and Shopify — after we reach out, you invite our team account from your site's Users/Members settings and revoke it when we're done. Never send passwords.",
  },
  {
    id: "guided",
    label: "I'll paste the snippet myself, with your help",
    hint: "We send exact click-by-click steps for your platform and stay on hand while you do it.",
  },
  {
    id: "zip",
    label: "Upload my project files (zip)",
    hint: "Best for custom or static sites — attach a zip of the site and we'll prepare the integrated version for you.",
  },
  {
    id: "unsure",
    label: "Not sure yet — advise me",
    hint: "We'll look at your site and recommend the easiest route.",
  },
] as const;

export function quotePlatformLabel(id: string): string {
  return QUOTE_PLATFORMS.find((p) => p.id === id)?.label ?? id;
}

export function quoteAccessLabel(id: string): string {
  return QUOTE_ACCESS_METHODS.find((a) => a.id === id)?.label ?? id;
}

export const QUOTE_FILE_MAX_BYTES = 25 * 1024 * 1024;
