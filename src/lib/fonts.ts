import {
  Geist,
  JetBrains_Mono,
  Lora,
  Nunito,
  Outfit,
  Playfair_Display,
  Space_Grotesk,
} from "next/font/google";

/**
 * Typefaces a creator can set their page in.
 *
 * Loaded through next/font, so they're self-hosted and served from our own
 * origin — a creator page makes no request to Google, and there's no
 * flash of fallback text while a stylesheet resolves.
 *
 * Every family here is variable, which is what lets one declaration carry the
 * whole page: the headings are 800, the body is 400, and no separate weight
 * files are fetched for either. A display face that only ships one weight
 * (Bebas and friends) is deliberately absent — it would set the body copy in
 * all-caps poster type.
 *
 * `font.style.fontFamily` is the resolved family name plus its size-adjusted
 * fallback, so it can be dropped straight into an inline style. That keeps
 * the picker tiles, the live preview and the public page reading from one
 * source with no class plumbing in between.
 */
const geist = Geist({ subsets: ["latin"], display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
const lora = Lora({ subsets: ["latin"], display: "swap" });
const nunito = Nunito({ subsets: ["latin"], display: "swap" });
const outfit = Outfit({ subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap" });

export interface FontDef {
  id: string;
  label: string;
  /** How it reads, in the picker. */
  note: string;
  /** Ready for `style={{ fontFamily }}`. */
  family: string;
}

export const FONTS: FontDef[] = [
  { id: "", label: "Geist", note: "Clean and neutral", family: geist.style.fontFamily },
  { id: "grotesk", label: "Space Grotesk", note: "Modern, a little technical", family: grotesk.style.fontFamily },
  { id: "outfit", label: "Outfit", note: "Geometric and friendly", family: outfit.style.fontFamily },
  { id: "playfair", label: "Playfair", note: "Editorial, high contrast", family: playfair.style.fontFamily },
  { id: "lora", label: "Lora", note: "Warm serif, easy to read", family: lora.style.fontFamily },
  { id: "nunito", label: "Nunito", note: "Rounded and approachable", family: nunito.style.fontFamily },
  { id: "mono", label: "JetBrains Mono", note: "Monospaced", family: mono.style.fontFamily },
];

export const DEFAULT_FONT = FONTS[0].id;

export function getFont(id: string | undefined | null): FontDef {
  return FONTS.find((f) => f.id === (id ?? "")) ?? FONTS[0];
}

/**
 * Overall text size, as a multiplier on the page's base size. Every text
 * size on a creator page is expressed in em, so one value here moves the
 * headline and the fine print together and keeps their proportions.
 */
export interface TextSize {
  id: string;
  label: string;
  value: string;
}

export const TEXT_SIZES: TextSize[] = [
  { id: "small", label: "Small", value: "0.9" },
  { id: "standard", label: "Standard", value: "1" },
  { id: "large", label: "Large", value: "1.12" },
  { id: "xl", label: "Extra large", value: "1.28" },
];

export const DEFAULT_TEXT_SIZE = TEXT_SIZES[1].value;

/** Text colors that stay legible on the dark backdrops. Any hex is allowed too. */
export const TEXT_COLORS = [
  { id: "white", label: "White", value: "#ffffff" },
  { id: "porcelain", label: "Porcelain", value: "#f4f1fb" },
  { id: "sand", label: "Sand", value: "#f5e9d7" },
  { id: "mint", label: "Mint", value: "#e6fff4" },
  { id: "slate", label: "Slate", value: "#cbd5e1" },
  { id: "ink", label: "Ink", value: "#0b0714" },
];

/** Inks that stay legible on the light backdrops. Any hex is allowed too. */
export const LIGHT_TEXT_COLORS = [
  { id: "ink", label: "Ink", value: "#0b0714" },
  { id: "graphite", label: "Graphite", value: "#1f2430" },
  { id: "slate", label: "Slate", value: "#334155" },
  { id: "espresso", label: "Espresso", value: "#2a1d14" },
  { id: "navy", label: "Navy", value: "#12203c" },
  { id: "white", label: "White", value: "#ffffff" },
];

export const DEFAULT_LIGHT_TEXT_COLOR = LIGHT_TEXT_COLORS[0].value;

export const DEFAULT_TEXT_COLOR = TEXT_COLORS[0].value;
