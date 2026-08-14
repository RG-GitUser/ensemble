import type { CSSProperties } from "react";

/**
 * Curated page-theme palettes — every plan gets all of them. Values end up in
 * inline styles on the public page, so only values from these lists are ever
 * persisted (updateSettings validates with pickSwatch). All backgrounds are
 * dark so the page's white text and borders stay readable.
 */
export interface Swatch {
  id: string;
  label: string;
  value: string;
}

export const ACCENTS: Swatch[] = [
  { id: "violet", label: "Violet", value: "#8b5cf6" },
  { id: "indigo", label: "Indigo", value: "#6366f1" },
  { id: "blue", label: "Blue", value: "#3b82f6" },
  { id: "cyan", label: "Cyan", value: "#06b6d4" },
  { id: "emerald", label: "Emerald", value: "#10b981" },
  { id: "lime", label: "Lime", value: "#84cc16" },
  { id: "amber", label: "Amber", value: "#f59e0b" },
  { id: "orange", label: "Orange", value: "#f97316" },
  { id: "rose", label: "Rose", value: "#f43f5e" },
  { id: "pink", label: "Pink", value: "#ec4899" },
];

export const BACKGROUNDS: Swatch[] = [
  { id: "ink", label: "Ink", value: "#0a0812" },
  { id: "charcoal", label: "Charcoal", value: "#101014" },
  { id: "midnight", label: "Midnight", value: "#0a1020" },
  { id: "ocean", label: "Deep ocean", value: "#06131c" },
  { id: "forest", label: "Forest", value: "#081410" },
  { id: "espresso", label: "Espresso", value: "#160e08" },
  { id: "plum", label: "Plum", value: "#170b1e" },
  { id: "wine", label: "Wine", value: "#1a0a10" },
];

export const CONTAINERS: Swatch[] = [
  { id: "frost", label: "Frost", value: "rgba(255,255,255,0.05)" },
  { id: "bright", label: "Bright frost", value: "rgba(255,255,255,0.1)" },
  { id: "shadow", label: "Shadow", value: "rgba(0,0,0,0.35)" },
  { id: "slate", label: "Slate", value: "#161622" },
  { id: "steel", label: "Steel", value: "#141b26" },
  { id: "moss", label: "Moss", value: "#12201a" },
];

/**
 * How wide the containers on a creator page run. The value multiplies every
 * section's base width, so the page keeps its own proportions — a links list
 * stays narrower than a merch grid at any setting.
 */
export const CONTAINER_SIZES: Swatch[] = [
  { id: "snug", label: "Snug", value: "0.75" },
  { id: "compact", label: "Compact", value: "0.88" },
  { id: "standard", label: "Standard", value: "1" },
  { id: "roomy", label: "Roomy", value: "1.15" },
  { id: "wide", label: "Wide", value: "1.35" },
];

/**
 * How the containers are arranged down the page.
 *
 * "scroll" is the original single column and stays the default, so a page
 * built before this existed is untouched. The other two only rearrange
 * sections that suit it: a hero is the page's headline and a merch grid is
 * already a grid, so both stay full width in every mode (FULL_WIDTH_TYPES).
 */
export interface LayoutDef {
  id: string;
  label: string;
  description: string;
}

export const LAYOUTS: LayoutDef[] = [
  {
    id: "scroll",
    label: "Landscape scroll",
    description: "One section after another, full width. The classic.",
  },
  {
    id: "side",
    label: "Side by side",
    description: "Sections pair up into two columns on wide screens, and stack on phones.",
  },
  {
    id: "stagger",
    label: "Staggered",
    description: "Sections alternate left and right down the page, like an editorial spread.",
  },
];

export const DEFAULT_LAYOUT = LAYOUTS[0].id;

/**
 * Section types that always span the full width, whatever the layout — the
 * page's headline and the line it closes on. Everything else takes part in
 * the arrangement, including the grids: a merch or video section narrows its
 * own columns to fit (see the container queries in globals.css) rather than
 * opting out of the layout the creator chose.
 */
export const FULL_WIDTH_TYPES = new Set(["hero", "footer"]);

export function getLayout(id: string | undefined | null): LayoutDef | null {
  if (!id) return null;
  return LAYOUTS.find((l) => l.id === id) ?? null;
}

/**
 * Border treatments for those containers. "ACCENT" (optionally followed by a
 * two-digit alpha, as in "ACCENT88") is replaced with the site's accent color,
 * the same convention lib/themes.ts uses.
 *
 * Widths and colors are kept apart rather than as `border` shorthands: the CSS
 * optimizer drops shorthands whose value is a var(), so `.site-card` has to
 * feed the longhands one at a time.
 */
export interface BorderStyleDef {
  id: string;
  label: string;
  /** Border width, as a CSS length. */
  width: string;
  color: string;
  /** Left edge, for styles that accent one side only — defaults to the above. */
  leftWidth?: string;
  leftColor?: string;
  shadow?: string;
  /** Border color under the cursor, on containers that are links. */
  hover: string;
}

export const BORDER_STYLES: BorderStyleDef[] = [
  { id: "hairline", label: "Hairline", width: "1px", color: "rgba(255,255,255,0.12)", hover: "rgba(255,255,255,0.32)" },
  {
    // Transparent rather than absent so switching styles never reflows the page.
    id: "soft",
    label: "Soft shadow",
    width: "1px",
    color: "transparent",
    shadow: "0 18px 40px -22px rgba(0,0,0,0.85)",
    hover: "rgba(255,255,255,0.2)",
  },
  { id: "accent", label: "Accent line", width: "1px", color: "ACCENT88", hover: "ACCENT" },
  {
    id: "glow",
    label: "Accent glow",
    width: "1px",
    color: "ACCENT66",
    shadow: "0 0 26px -6px ACCENT66",
    hover: "ACCENT",
  },
  { id: "bold", label: "Bold", width: "2px", color: "ACCENTcc", hover: "ACCENT" },
  {
    id: "side",
    label: "Side bar",
    width: "1px",
    color: "rgba(255,255,255,0.1)",
    leftWidth: "4px",
    leftColor: "ACCENT",
    hover: "rgba(255,255,255,0.3)",
  },
];

export const DEFAULT_ACCENT = ACCENTS[0].value;
export const DEFAULT_BG = BACKGROUNDS[0].value;
export const DEFAULT_CARD = CONTAINERS[0].value;
export const DEFAULT_SIZE = CONTAINER_SIZES[2].value;
export const DEFAULT_BORDER = BORDER_STYLES[0].id;

/** The candidate if it's in the palette, otherwise the fallback. */
export function pickSwatch(list: Swatch[], value: string, fallback: string): string {
  return list.some((s) => s.value === value) ? value : fallback;
}

/**
 * A creator-typed color, normalized to #rrggbb — "" when it isn't one.
 *
 * Hex only, deliberately: these values are interpolated straight into inline
 * styles and custom properties on the public page, so the grammar has to be
 * one we can verify completely rather than "whatever a browser might parse".
 */
export function normalizeHex(input: string): string {
  const v = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(v)) {
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toLowerCase()}`;
  return "";
}

/**
 * Palette value, else a valid custom hex, else the fallback. The palette-only
 * `pickSwatch` still guards the fields where a free color would break
 * something (the accent is concatenated with alpha suffixes; sizes and border
 * ids aren't colors at all).
 */
export function pickColor(list: Swatch[], value: string, fallback: string): string {
  if (list.some((s) => s.value === value)) return value;
  return normalizeHex(value) || fallback;
}

/**
 * True when white text on this color falls under 4.5:1 — creator pages draw
 * their copy in fixed white, so a light custom color is a legibility problem
 * rather than a taste one. Non-hex (the translucent palette tints) is never
 * flagged: those composite over the backdrop, which is checked on its own.
 */
export function isLight(color: string): boolean {
  const hex = normalizeHex(color);
  if (!hex) return false;
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  // White (L = 1) clears 4.5:1 against everything up to L ≈ 0.183.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.183;
}

export function getBorderStyle(id: string | undefined | null): BorderStyleDef | null {
  if (!id) return null;
  return BORDER_STYLES.find((b) => b.id === id) ?? null;
}

function withAccent(css: string, accent: string): string {
  return css.replace(/ACCENT([0-9a-f]{2})/gi, `${accent}$1`).replace(/ACCENT/g, accent);
}

/** Resolved border style, accent substituted in, falling back to the default. */
function resolveBorder(id: string | undefined | null, accent: string) {
  const b = getBorderStyle(id) ?? BORDER_STYLES[0];
  const color = withAccent(b.color, accent);
  return {
    width: b.width,
    color,
    leftWidth: b.leftWidth ?? b.width,
    leftColor: b.leftColor ? withAccent(b.leftColor, accent) : color,
    shadow: b.shadow ? withAccent(b.shadow, accent) : "none",
    hover: withAccent(b.hover, accent),
  };
}

/** Inline CSS for one container — used by the builder's preview tiles. */
export function borderCss(id: string | undefined | null, accent: string): CSSProperties {
  const b = resolveBorder(id, accent);
  return {
    borderStyle: "solid",
    borderWidth: b.width,
    borderColor: b.color,
    borderLeftWidth: b.leftWidth,
    borderLeftColor: b.leftColor,
    boxShadow: b.shadow,
  };
}

/** The same style as custom properties, read by `.site-card` on the public page. */
export function borderVars(id: string | undefined | null, accent: string): Record<string, string> {
  const b = resolveBorder(id, accent);
  return {
    "--site-border-width": b.width,
    "--site-border-color": b.color,
    "--site-border-left-width": b.leftWidth,
    "--site-border-left-color": b.leftColor,
    "--site-shadow": b.shadow,
    "--site-border-hover": b.hover,
  };
}
