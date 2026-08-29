import type { CSSProperties } from "react";

/**
 * Curated page-theme palettes — every plan gets all of them. Values end up in
 * inline styles on the public page, so only values from these lists are ever
 * persisted (updateSettings validates with pickSwatch).
 *
 * This is the dark palette, so every value in it takes pale text. The light
 * ones live in LIGHT_BACKGROUNDS and are offered by the light-mode controls,
 * where the ink is dark and they are legible.
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

/**
 * Ink stays first: DEFAULT_BG is BACKGROUNDS[0], so every page that never
 * chose a background is sitting on it.
 *
 * Dropping a swatch is safe — pickColor falls through to normalizeHex, so a
 * page still holding a retired value keeps rendering it. Forest, Espresso and
 * Wine went that way: at these depths they read as the same near-black as Ink,
 * and a picker of eight indistinguishable darks is a picker of one.
 */
export const BACKGROUNDS: Swatch[] = [
  // Dark
  { id: "ink", label: "Ink", value: "#0a0812" },
  { id: "charcoal", label: "Charcoal", value: "#101014" },
  { id: "midnight", label: "Midnight", value: "#0a1020" },
  { id: "ocean", label: "Deep ocean", value: "#06131c" },
  { id: "plum", label: "Plum", value: "#170b1e" },
  // Mid — still comfortably white-text territory.
  { id: "slate", label: "Slate", value: "#1e2230" },
  { id: "cocoa", label: "Cocoa", value: "#241a16" },
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
 * Light-mode counterparts to BACKGROUNDS and CONTAINERS. A creator page is
 * dark by default, so these only come into play once light or visitor-choice
 * is switched on — but when they do, the same picker UI drives them.
 */
export const LIGHT_BACKGROUNDS: Swatch[] = [
  { id: "paper", label: "Paper", value: "#faf9fc" },
  { id: "bone", label: "Bone", value: "#f5f3ee" },
  { id: "mist", label: "Mist", value: "#eef2f7" },
  { id: "sky", label: "Sky", value: "#eef4fb" },
  { id: "sage", label: "Sage", value: "#eef5ef" },
  { id: "linen", label: "Linen", value: "#faf4ec" },
  { id: "blush", label: "Blush", value: "#fbf0f4" },
  { id: "lilac", label: "Lilac", value: "#f4f0fb" },
];

export const LIGHT_CONTAINERS: Swatch[] = [
  { id: "white", label: "White", value: "rgba(255,255,255,0.72)" },
  { id: "solid", label: "Solid white", value: "#ffffff" },
  { id: "tint", label: "Tint", value: "rgba(0,0,0,0.04)" },
  { id: "shell", label: "Shell", value: "#f3f1ee" },
  { id: "haze", label: "Haze", value: "#eef1f6" },
  { id: "cloud", label: "Cloud", value: "#eff4f1" },
];

/** How many named looks a creator can keep. */
export const MAX_LOOKS = 8;

export type ColorMode = "dark" | "light" | "auto";

/**
 * How many looks a page has, and which.
 *
 * The first two are one palette: whichever the creator's own design already
 * is. The third is both, and is the only case where there is a second palette
 * to design at all.
 */
export const COLOR_MODES: Array<{ id: ColorMode; name: string; hint: string }> = [
  { id: "dark", name: "Dark", hint: "One look. Your page is dark for everyone." },
  { id: "light", name: "Light", hint: "One look. Your page is light for everyone." },
  { id: "auto", name: "Both", hint: "Whichever suits the visitor's device, plus a switch on your page." },
];

export const DEFAULT_COLOR_MODE: ColorMode = "dark";
export const DEFAULT_LIGHT_BG = LIGHT_BACKGROUNDS[0].value;
export const DEFAULT_LIGHT_CARD = LIGHT_CONTAINERS[0].value;

export function getColorMode(id: string | undefined | null): ColorMode {
  return COLOR_MODES.some((m) => m.id === id) ? (id as ColorMode) : DEFAULT_COLOR_MODE;
}

/**
 * Container edges are authored for a dark page, so most of them are white at
 * a low alpha — which is invisible on a light one. Flipping white to black
 * keeps the creator's chosen weight and leaves accent-coloured edges alone.
 */
export function edgeForLight(color: string): string {
  return color
    .replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,/gi, "rgba(0, 0, 0,")
    .replace(/#ffffff([0-9a-f]{2})/gi, "#000000$1")
    .replace(/^#ffffff$/i, "#000000");
}

/**
 * How wide the containers on a creator page run. The value multiplies every
 * section's base width, so the page keeps its own proportions — a links list
 * stays narrower than a merch grid at any setting.
 */
/**
 * Container width is a free multiplier now, not one of five presets.
 *
 * The creator drags the edge of a sample container and lands wherever they
 * like between these bounds. The old named steps sat inside this range, so a
 * page that stored one keeps rendering at exactly the width it always did.
 */
export const SIZE_MIN = 0.6;
export const SIZE_MAX = 1.6;
/** Two decimals is finer than the eye can tell at these widths. */
export function clampSize(raw: string | number | undefined | null): string {
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n)) return DEFAULT_SIZE;
  return String(Math.round(Math.min(SIZE_MAX, Math.max(SIZE_MIN, n)) * 100) / 100);
}

/**
 * Which way the copy inside a container runs.
 *
 * Set per section rather than per page: a creator centring their hero and
 * left-aligning a long About passage is the normal case, and one page-wide
 * switch cannot express it.
 *
 * Sections are authored centred, so "center" is the default and the no-op.
 * The other two are applied by `.site-align-*` in globals.css, which retargets
 * prose elements only. Buttons and badges stay centred whatever is picked.
 */
export const TEXT_ALIGNS: Swatch[] = [
  { id: "left", label: "Left", value: "left" },
  { id: "center", label: "Center", value: "center" },
  { id: "right", label: "Right", value: "right" },
];

export const DEFAULT_TEXT_ALIGN = TEXT_ALIGNS[1].value;

/** A stored section alignment, or the centred default for "" and anything unknown. */
export function getTextAlign(value: string | undefined | null): string {
  return TEXT_ALIGNS.some((a) => a.value === value) ? (value as string) : DEFAULT_TEXT_ALIGN;
}

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
  {
    id: "focus",
    label: "Focused column",
    description: "One narrow centred column, link-in-bio style. Your hero stays full width above it.",
  },
];

export const DEFAULT_LAYOUT = LAYOUTS[0].id;

/**
 * Page-shape scales: how much air between sections, and how round the
 * containers' corners are.
 *
 * Both are stored as an id and rendered as a bare multiplier in a CSS var
 * (--site-rhythm, --site-round), so every padding and radius on the page
 * moves together and keeps its own proportions — a hero keeps being taller
 * than a footer at any density, a big card keeps being rounder than its
 * button at any corner setting. The middle option of each is the exact page
 * shipped before the setting existed, so absent config changes nothing.
 */
export interface ScaleDef {
  id: string;
  label: string;
  blurb: string;
  /** Bare multiplier, written into the page's CSS var. */
  value: string;
}

export const SPACINGS: ScaleDef[] = [
  { id: "cozy", label: "Cozy", blurb: "Sections sit close — more page per scroll.", value: "0.6" },
  { id: "standard", label: "Standard", blurb: "The classic rhythm.", value: "1" },
  { id: "airy", label: "Airy", blurb: "Every section gets room to breathe.", value: "1.5" },
];

export const DEFAULT_SPACING = SPACINGS[1].id;

export function getSpacing(id: string | undefined | null): ScaleDef | null {
  return SPACINGS.find((s) => s.id === id) ?? null;
}

export const CORNERS: ScaleDef[] = [
  { id: "sharp", label: "Sharp", blurb: "Square edges — editorial and precise.", value: "0" },
  { id: "soft", label: "Soft", blurb: "Gently rounded, as pages ship today.", value: "1" },
  { id: "round", label: "Round", blurb: "Fully rounded cards and pill buttons.", value: "2" },
];

export const DEFAULT_CORNER = CORNERS[1].id;

export function getCorner(id: string | undefined | null): ScaleDef | null {
  return CORNERS.find((c) => c.id === id) ?? null;
}

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
export const DEFAULT_SIZE = "1";

/**
 * A floor under every container, in rem, with 0 meaning none.
 *
 * A floor rather than a fixed height because sections hold wildly different
 * amounts: a links list is short, a merch grid is tall, a chatroom scrolls.
 * One exact height would either clip the tall ones or strand the short ones in
 * whitespace. A minimum lets a thin section fill out while a full one still
 * grows past it, so nothing is ever hidden.
 *
 * rem rather than pixels so it rides the creator's type scale and never
 * outruns a phone screen the way a literal pixel height would.
 */
export const MIN_HEIGHT_MAX = 24;
export const DEFAULT_MIN_HEIGHT = "0";

export function clampMinHeight(raw: string | number | undefined | null): string {
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n)) return DEFAULT_MIN_HEIGHT;
  return String(Math.round(Math.min(MIN_HEIGHT_MAX, Math.max(0, n)) * 2) / 2);
}
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
