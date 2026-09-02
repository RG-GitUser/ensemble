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
  {
    id: "storefront",
    label: "Storefront",
    description: "Your portrait, name and links pin to one side while your offers sit in a grid beside them.",
  },
];

/**
 * How the storefront portrait is framed.
 *
 * Curated treatments rather than a free-form border, so nobody lands on
 * something that fights their palette. Every ring is drawn from the page's
 * own accent, which means a frame follows the colours they already chose
 * instead of introducing a new one.
 */
export interface FrameDef {
  id: string;
  label: string;
  blurb: string;
}

export const FRAMES: FrameDef[] = [
  { id: "none", label: "None", blurb: "Just the photo, cropped to a circle." },
  { id: "ring", label: "Ring", blurb: "A clean band in your accent colour." },
  { id: "gradient", label: "Gradient", blurb: "The band fades across your accent into the light." },
  { id: "glow", label: "Glow", blurb: "A soft halo with no hard edge." },
];

export const DEFAULT_FRAME = FRAMES[1].id;

export function getFrame(id: string | undefined | null): FrameDef | null {
  return FRAMES.find((f) => f.id === id) ?? null;
}

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
/**
 * How strong the accent wash over the backdrop is.
 *
 * Stored as the hex alpha suffix the page concatenates onto the accent, the
 * same trick the border styles use, so the strength travels as part of the
 * colour rather than as a second value to keep in step.
 */
export interface GlowDef {
  id: string;
  label: string;
  blurb: string;
  /** Two hex digits appended to the accent. */
  alpha: string;
}

/**
 * The three original ids keep their exact alphas: they are stored in saved
 * configs, so renaming or renumbering them would silently restyle live pages.
 * The two additions bracket the range instead — several presets already carry
 * their own gradient artwork, and against those a "soft" 33 was still too much
 * wash, while a flat backdrop had nothing beyond 88.
 */
export const GLOWS: GlowDef[] = [
  { id: "faint", label: "Faint", blurb: "Barely there — for backdrops that already glow.", alpha: "1a" },
  { id: "soft", label: "Soft", blurb: "A hint of colour at the top.", alpha: "33" },
  { id: "medium", label: "Medium", blurb: "The wash pages shipped with.", alpha: "55" },
  { id: "strong", label: "Strong", blurb: "Unmistakably your colour.", alpha: "88" },
  { id: "vivid", label: "Vivid", blurb: "Full saturation, for flat backdrops.", alpha: "cc" },
];

export const DEFAULT_GLOW = "medium";

export function getGlow(id: string | undefined | null): GlowDef | null {
  return GLOWS.find((g) => g.id === id) ?? null;
}

/**
 * How far the accent wash spreads.
 *
 * Carries both geometries because the two places that draw it are not the same
 * size: the page paints into a viewport and uses pixels, the Design preview
 * paints into a ~24rem column and uses percentages. Deriving one from the
 * other by ratio drifts at the extremes, so each size states both and the
 * caller picks the field that matches its surface.
 */
export interface GlowSizeDef {
  id: string;
  label: string;
  blurb: string;
  /** `radial-gradient` geometry for the full page. */
  page: string;
  /** The same shape at Design-preview scale. */
  preview: string;
}

export const GLOW_SIZES: GlowSizeDef[] = [
  { id: "tight", label: "Tight", blurb: "A small pool right at the top.", page: "420px 240px", preview: "34% 26%" },
  { id: "regular", label: "Regular", blurb: "The spread pages shipped with.", page: "800px 400px", preview: "62% 44%" },
  { id: "wide", label: "Wide", blurb: "Reaches most of the way across.", page: "1200px 560px", preview: "92% 62%" },
  { id: "full", label: "Full", blurb: "Washes the whole top of the page.", page: "1800px 760px", preview: "140% 84%" },
];

export const DEFAULT_GLOW_SIZE = "regular";

export function getGlowSize(id: string | undefined | null): GlowSizeDef | null {
  return GLOW_SIZES.find((g) => g.id === id) ?? null;
}

/**
 * How the accent paints a button.
 *
 * Each writes the three custom properties the page's buttons read, so a button
 * anywhere gets the treatment without knowing which one is set. Solid is what
 * every page had before this existed, so an absent setting changes nothing.
 */
export interface ButtonStyleDef {
  id: string;
  label: string;
  blurb: string;
  /** Background, text colour and border, as CSS values. ACCENT is substituted. */
  bg: string;
  ink: string;
  border: string;
}

export const BUTTON_STYLES: ButtonStyleDef[] = [
  { id: "solid", label: "Solid", blurb: "Filled with your accent.", bg: "ACCENT", ink: "#fff", border: "transparent" },
  {
    id: "gradient",
    label: "Gradient",
    blurb: "Your accent fading into itself.",
    bg: "linear-gradient(135deg, ACCENT, ACCENTaa)",
    ink: "#fff",
    border: "transparent",
  },
  {
    id: "outline",
    label: "Outline",
    blurb: "Just the edge, in your accent.",
    bg: "transparent",
    ink: "ACCENT",
    border: "ACCENT",
  },
  {
    id: "soft",
    label: "Soft",
    blurb: "A tint of your accent behind the words.",
    bg: "ACCENT2e",
    ink: "ACCENT",
    border: "ACCENT55",
  },
];

export const DEFAULT_BUTTON_STYLE = BUTTON_STYLES[0].id;

export function getButtonStyle(id: string | undefined | null): ButtonStyleDef | null {
  return BUTTON_STYLES.find((b) => b.id === id) ?? null;
}

/** The button style as the custom properties the public page reads. */
export function buttonVars(id: string | undefined | null, accent: string): Record<string, string> {
  const b = getButtonStyle(id) ?? BUTTON_STYLES[0];
  return {
    "--site-btn-bg": withAccent(b.bg, accent),
    "--site-btn-ink": withAccent(b.ink, accent),
    "--site-btn-border": withAccent(b.border, accent),
  };
}

/**
 * What a container or a button does when the pointer is over it.
 *
 * Stored as an id and applied as a class, not an inline style, because there
 * is no inline syntax for :hover — the rules live in globals.css beside the
 * other .site-* rules and read the accent from --site-accent, so a hover can
 * never introduce a colour nobody chose.
 *
 * "none" is first and is the default, so a page built before this existed
 * behaves exactly as it did.
 */
export interface HoverDef {
  id: string;
  label: string;
  blurb: string;
}

export const CONTAINER_HOVERS: HoverDef[] = [
  { id: "none", label: "None", blurb: "Containers sit still." },
  { id: "lift", label: "Lift", blurb: "Rises slightly, with a shadow under it." },
  { id: "glow", label: "Glow", blurb: "A halo in your accent colour." },
  { id: "outline", label: "Outline", blurb: "The edge picks up your accent." },
  { id: "brighten", label: "Brighten", blurb: "Lightens a touch." },
];

export const BUTTON_HOVERS: HoverDef[] = [
  { id: "none", label: "None", blurb: "Buttons sit still." },
  { id: "lift", label: "Lift", blurb: "Rises slightly, with a shadow under it." },
  { id: "glow", label: "Glow", blurb: "A halo in your accent colour." },
  { id: "invert", label: "Invert", blurb: "Swaps its fill and its text." },
  { id: "grow", label: "Grow", blurb: "Scales up a little." },
];

export const DEFAULT_CONTAINER_HOVER = "none";
export const DEFAULT_BUTTON_HOVER = "none";

export function getContainerHover(id: string | undefined | null): HoverDef | null {
  return CONTAINER_HOVERS.find((h) => h.id === id) ?? null;
}

export function getButtonHover(id: string | undefined | null): HoverDef | null {
  return BUTTON_HOVERS.find((h) => h.id === id) ?? null;
}

/** The class a container carries, or "" for the default no-op. */
export function containerHoverClass(id: string | undefined | null): string {
  const h = getContainerHover(id)?.id ?? DEFAULT_CONTAINER_HOVER;
  return h === "none" ? "" : `site-hover-c-${h}`;
}

/** The class a button carries, or "" for the default no-op. */
export function buttonHoverClass(id: string | undefined | null): string {
  const h = getButtonHover(id)?.id ?? DEFAULT_BUTTON_HOVER;
  return h === "none" ? "" : `site-hover-b-${h}`;
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
  const vars: Record<string, string> = {
    "--site-border-width": b.width,
    "--site-border-color": b.color,
    "--site-border-left-width": b.leftWidth,
    "--site-border-left-color": b.leftColor,
    "--site-border-hover": b.hover,
  };
  // Only set when the style brings its own shadow. resolveBorder collapses
  // "no shadow" to the string "none" for the inline preview tiles, which is
  // right there, but writing that here would override the stylesheet's
  // default lift with an explicit none and flatten every container.
  if (b.shadow !== "none") vars["--site-shadow"] = b.shadow;
  return vars;
}

/**
 * How the rows of a list section are marked.
 *
 * One setting with four modes rather than a bullet picker beside a numbering
 * switch, because they are the same decision: what sits to the left of each
 * row. A list is numbered, lettered, bulleted or bare, and it cannot be two of
 * those at once — which a separate picker and switch quietly allowed.
 */
export type MarkerMode = "none" | "number" | "letter" | "bullet";

export interface MarkerModeDef {
  id: MarkerMode;
  label: string;
  blurb: string;
  /** What the first three rows would show, for the picker tiles. */
  sample: [string, string, string];
}

export const MARKER_MODES: MarkerModeDef[] = [
  { id: "none", label: "None", blurb: "Rows stand on their own.", sample: ["", "", ""] },
  { id: "number", label: "Numbered", blurb: "For steps and rankings.", sample: ["1", "2", "3"] },
  { id: "letter", label: "Lettered", blurb: "For options and tiers.", sample: ["A", "B", "C"] },
  { id: "bullet", label: "Bullet", blurb: "For plain lists.", sample: ["•", "•", "•"] },
];

export const DEFAULT_MARKER: MarkerMode = "none";

/**
 * Where a section's marker sits.
 *
 * "above" centres it over the heading, which is where a number or a letter
 * reads as a step. "corner" pins it outside the container at the top left,
 * which is the only place a bullet works — centred over a heading a lone dot
 * or arrow reads as a stray glyph rather than a marker, so bullets are forced
 * there rather than offered the choice.
 */
export type MarkerPosition = "above" | "corner";

export const MARKER_POSITIONS: Array<{ id: MarkerPosition; label: string; blurb: string }> = [
  { id: "above", label: "Above heading", blurb: "Centred over the section." },
  { id: "corner", label: "Outer corner", blurb: "Top left, outside the container." },
];

export const DEFAULT_MARKER_POSITION: MarkerPosition = "above";

export function getMarkerPosition(id: string | undefined | null): MarkerPosition {
  return id === "corner" ? "corner" : "above";
}

/**
 * Where a section's marker sits.
 *
 * Bullets used to be pinned to the corner unconditionally. That kept sections
 * written before the setting existed from ending up with a lone dot centred
 * over a heading, but it also meant the position control did nothing for them.
 *
 * The distinction that actually matters is whether anyone chose. An absent
 * position on a bullet still resolves to the corner, so every page that predates
 * the control looks exactly as it did; an explicit choice is now honoured for
 * bullets the same as for numbers and letters.
 */
export function resolveMarkerPosition(mode: string | undefined | null, position: string | undefined | null): MarkerPosition {
  if ((getMarkerMode(mode)?.id ?? DEFAULT_MARKER) === "bullet" && !position) return "corner";
  return getMarkerPosition(position);
}

export function getMarkerMode(id: string | undefined | null): MarkerModeDef | null {
  return MARKER_MODES.find((m) => m.id === id) ?? null;
}

/**
 * The three bullet shapes, drawn as SVG paths on a 24x24 box.
 *
 * Paths rather than typed characters, so a marker is the same shape on every
 * device instead of at the mercy of the creator's font and the visitor's emoji
 * table. Three deliberately distinct jobs: a dot is neutral, a tick reads as
 * something gained, an arrow points onward to what the row links to. Each
 * takes the page accent, so a marker never introduces a colour nobody chose.
 */
export interface BulletShapeDef {
  id: string;
  label: string;
  path: string;
}

export const BULLET_SHAPES: BulletShapeDef[] = [
  { id: "dot", label: "Dot", path: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
  { id: "tick", label: "Tick", path: "M20 6.5 9.5 17 4 11.5l1.5-1.5 4 4 9-9 1.5 1.5Z" },
  { id: "arrow", label: "Arrow", path: "M13 5l7 7-7 7-1.4-1.4 4.6-4.6H4v-2h12.2l-4.6-4.6L13 5Z" },
];

export const DEFAULT_BULLET_SHAPE = BULLET_SHAPES[0].id;

export function getBulletShape(id: string | undefined | null): BulletShapeDef | null {
  return BULLET_SHAPES.find((b) => b.id === id) ?? null;
}

/** The marker for row `i` (zero-based): "1.", "C.", a shape id, or "". */
export function markerFor(mode: string | undefined | null, i: number): { text: string; shape: boolean } {
  const m = getMarkerMode(mode)?.id ?? DEFAULT_MARKER;
  if (m === "number") return { text: `${i + 1}.`, shape: false };
  // Past Z it wraps to AA, BB, CC rather than running out or repeating A.
  if (m === "letter") {
    const letter = String.fromCharCode(65 + (i % 26));
    return { text: `${letter.repeat(Math.floor(i / 26) + 1)}.`, shape: false };
  }
  if (m === "bullet") return { text: "", shape: true };
  return { text: "", shape: false };
}
