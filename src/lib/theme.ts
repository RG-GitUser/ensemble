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

export const DEFAULT_ACCENT = ACCENTS[0].value;
export const DEFAULT_BG = BACKGROUNDS[0].value;
export const DEFAULT_CARD = CONTAINERS[0].value;

/** The candidate if it's in the palette, otherwise the fallback. */
export function pickSwatch(list: Swatch[], value: string, fallback: string): string {
  return list.some((s) => s.value === value) ? value : fallback;
}
