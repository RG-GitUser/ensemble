import type { CSSProperties } from "react";

/**
 * Backdrops for creator pages — CSS gradient stacks and SVG textures, no
 * image files. A backdrop can be applied site-wide (site.config.themeId) and
 * overridden per section (section.theme), where it renders as a themed band.
 *
 * Two rules govern everything in here:
 *
 * 1. "ACCENT" in a definition is replaced with the site's accent color, and
 *    "ACCENT" + two lowercase hex digits adds an alpha suffix ("ACCENT55").
 *    That substitution is only safe in the CSS parts of a layer. Inside an
 *    SVG data URI a literal "#" truncates the URI, so textures are built from
 *    white/black alpha only and take their color from a gradient layered with
 *    them.
 * 2. Every layer list is deterministic — these strings are rendered on the
 *    server and again on the client, so nothing may vary between the two.
 *    Where a texture wants scattered detail, it comes from the seeded
 *    generator below rather than Math.random.
 *
 * No film grain or noise: an feTurbulence wash over a gradient reads as a
 * dirty screen at any opacity that's visible at all. Texture here means
 * drawn shapes — stars, contours, halftone dots, rules — which stay crisp.
 */

export interface ThemeDef {
  id: string;
  name: string;
  /** Which shelf of the picker this sits on. */
  group: ThemeGroup;
  /** background-image layers (gradients / SVG data URIs), comma separated. */
  image: string;
  color: string;
  size?: string;
  position?: string;
  repeat?: string;
}

export type ThemeGroup = "Light & color" | "Texture" | "Pattern" | "Bright";

export const THEME_GROUPS: ThemeGroup[] = ["Light & color", "Texture", "Pattern", "Bright"];

/** Backdrops that need dark text — the picker says so when one is chosen. */
export const BRIGHT_GROUP: ThemeGroup = "Bright";

function svg(markup: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}

/** Deterministic pseudo-random — same sequence on the server and the client. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// ── Textures ──────────────────────────────────────────────────────────────

/** Contour lines — nested rings, each one nudged off the last. */
const TOPO = (() => {
  const rnd = seeded(20260814);
  let paths = "";
  for (let i = 0; i < 11; i++) {
    const r = 26 + i * 30;
    const cx = 200 + (rnd() - 0.5) * 46;
    const cy = 200 + (rnd() - 0.5) * 46;
    const ry = r * (0.72 + rnd() * 0.2);
    paths += `<ellipse cx='${cx.toFixed(1)}' cy='${cy.toFixed(1)}' rx='${r}' ry='${ry.toFixed(1)}' transform='rotate(${(rnd() * 40 - 20).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})'/>`;
  }
  return svg(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><g fill='none' stroke='rgba(255,255,255,0.09)' stroke-width='1.1'>${paths}</g></svg>`
  );
})();

/** Halftone — dots that swell across the tile, the way print screens do. */
const HALFTONE = (() => {
  let dots = "";
  const step = 18;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      // Radius tracks distance from the top-left, so tiles read as a ramp.
      const r = 1 + ((x + y) / 14) * 3.4;
      dots += `<circle cx='${x * step + 9}' cy='${y * step + 9}' r='${r.toFixed(2)}' fill='rgba(255,255,255,0.13)'/>`;
    }
  }
  return svg(`<svg xmlns='http://www.w3.org/2000/svg' width='144' height='144'>${dots}</svg>`);
})();

/** Night sky. Three brightnesses so it has depth rather than looking sprayed. */
const STARS = (() => {
  const rnd = seeded(99173);
  let stars = "";
  for (let i = 0; i < 90; i++) {
    const x = (rnd() * 600).toFixed(1);
    const y = (rnd() * 600).toFixed(1);
    const r = (0.5 + rnd() * 1.3).toFixed(2);
    const o = (0.25 + rnd() * 0.6).toFixed(2);
    stars += `<circle cx='${x}' cy='${y}' r='${r}' fill='rgba(255,255,255,${o})'/>`;
  }
  return svg(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>${stars}</svg>`);
})();

const DOTS = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><circle cx='2' cy='2' r='1.5' fill='rgba(255,255,255,0.14)'/></svg>`
);

const GRID = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><path d='M44 0H0v44' fill='none' stroke='rgba(255,255,255,0.07)'/></svg>`
);

const WAVES = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320' preserveAspectRatio='none'><path fill='rgba(255,255,255,0.05)' d='M0,192L60,181.3C120,171,240,149,360,154.7C480,160,600,192,720,197.3C840,203,960,181,1080,165.3C1200,149,1320,139,1380,133.3L1440,128L1440,320L0,320Z'/><path fill='rgba(255,255,255,0.08)' d='M0,256L80,240C160,224,320,192,480,197.3C640,203,800,245,960,250.7C1120,256,1280,224,1360,208L1440,192L1440,320L0,320Z'/></svg>`
);

/**
 * The catalogue.
 *
 * Ids are permanent: a saved page stores the id, and an id that disappears
 * silently drops that creator back to a plain background. So looks get
 * reworked in place under the id they shipped with, never renumbered.
 */
export const THEMES: ThemeDef[] = [
  // ── Light & color ───────────────────────────────────────────────────────
  {
    // Curtains of light from the top corners, cooling to teal at the floor —
    // the ceiling glow alone was the generic version of this.
    id: "aurora",
    name: "Aurora",
    group: "Light & color",
    image:
      "radial-gradient(120% 70% at 8% -18%, rgba(52,211,153,0.34), transparent 58%), " +
      "radial-gradient(110% 65% at 92% -12%, rgba(129,140,248,0.36), transparent 58%), " +
      "radial-gradient(140% 55% at 50% 118%, rgba(34,211,238,0.20), transparent 62%), " +
      "linear-gradient(180deg, #071016 0%, #04080f 100%)",
    color: "#04080f",
  },
  {
    // A horizon: banded sky, a sun sitting on the line, dark ground below.
    id: "sunset",
    name: "Sunset",
    group: "Light & color",
    image:
      "radial-gradient(38% 22% at 50% 62%, rgba(255,183,94,0.55), rgba(255,140,80,0.18) 55%, transparent 72%), " +
      "linear-gradient(180deg, rgba(76,29,149,0.55) 0%, rgba(219,39,119,0.42) 38%, rgba(249,115,22,0.38) 60%, rgba(12,6,20,0.9) 72%, #0b0512 100%)",
    color: "#0b0512",
  },
  {
    id: "ocean",
    name: "Deep water",
    group: "Light & color",
    image: `${WAVES}, radial-gradient(90% 60% at 50% -10%, rgba(56,189,248,0.22), transparent 62%), linear-gradient(180deg, rgba(14,116,144,0.30), rgba(15,23,80,0.42))`,
    color: "#03101c",
    size: "100% 34%, cover, cover",
    position: "bottom, center, center",
    repeat: "no-repeat, no-repeat, no-repeat",
  },
  {
    // Four colour wells pulling against each other — a mesh, not a wash.
    id: "candy",
    name: "Mesh",
    group: "Light & color",
    image:
      "radial-gradient(58% 52% at 18% 12%, rgba(244,114,182,0.42), transparent 62%), " +
      "radial-gradient(52% 48% at 84% 22%, rgba(56,189,248,0.34), transparent 60%), " +
      "radial-gradient(60% 55% at 72% 88%, rgba(167,139,250,0.40), transparent 62%), " +
      "radial-gradient(46% 44% at 12% 84%, rgba(251,191,36,0.24), transparent 60%)",
    color: "#10081a",
  },
  {
    // Canopy light: a bright break at the top, deep shade in the corners.
    id: "forest",
    name: "Canopy",
    group: "Light & color",
    image:
      "radial-gradient(70% 45% at 50% -8%, rgba(163,230,53,0.26), transparent 62%), " +
      "radial-gradient(90% 70% at 20% 110%, rgba(6,95,70,0.55), transparent 60%), " +
      "radial-gradient(90% 70% at 85% 105%, rgba(4,120,87,0.35), transparent 58%), " +
      "linear-gradient(180deg, #061410 0%, #03100c 100%)",
    color: "#03100c",
  },
  {
    // Warm metal — a low sheen sweeping across, not a yellow blob.
    id: "gold",
    name: "Brass",
    group: "Light & color",
    image:
      "linear-gradient(105deg, transparent 18%, rgba(253,224,71,0.20) 38%, rgba(251,191,36,0.30) 48%, rgba(180,83,9,0.18) 60%, transparent 82%), " +
      "linear-gradient(180deg, #1a1206 0%, #0d0903 100%)",
    color: "#0d0903",
  },
  {
    id: "prism",
    name: "Prism",
    group: "Light & color",
    image:
      "linear-gradient(118deg, rgba(56,189,248,0.30) 0%, transparent 38%), " +
      "linear-gradient(238deg, rgba(244,114,182,0.30) 0%, transparent 38%), " +
      "linear-gradient(2deg, rgba(163,230,53,0.16) 0%, transparent 52%), " +
      "linear-gradient(180deg, #0c0a18, #07060f)",
    color: "#07060f",
  },
  {
    // The one that follows the creator's accent, now as a stage wash.
    id: "accent",
    name: "Spotlight",
    group: "Light & color",
    image:
      "radial-gradient(42% 60% at 50% -6%, ACCENT66, transparent 62%), " +
      "conic-gradient(from 200deg at 50% -8%, transparent 0deg, ACCENT1f 24deg, transparent 52deg), " +
      "linear-gradient(180deg, #0a0812 0%, #06050c 100%)",
    color: "#06050c",
  },
  {
    // Duotone split — one hard diagonal, the strongest shape in the set.
    id: "split",
    name: "Split",
    group: "Light & color",
    image:
      "linear-gradient(107deg, ACCENT2a 0%, ACCENT2a 46%, transparent 46.3%), " +
      "linear-gradient(107deg, transparent 46%, rgba(255,255,255,0.05) 46.3%, rgba(255,255,255,0.05) 100%), " +
      "linear-gradient(180deg, #0d0b16, #08070f)",
    color: "#08070f",
  },

  {
    // One luminous beam along the top edge over near-black — the look most
    // modern product sites land on, and the quietest way to use the accent.
    id: "beam",
    name: "Beam",
    group: "Light & color",
    image:
      "linear-gradient(180deg, ACCENTcc 0%, transparent 1.5px), " +
      "radial-gradient(60% 34% at 50% 0%, ACCENT40, transparent 70%), " +
      "radial-gradient(120% 60% at 50% 0%, rgba(255,255,255,0.05), transparent 60%), " +
      "linear-gradient(180deg, #0b0b12 0%, #050509 100%)",
    color: "#050509",
  },
  {
    // Twilight bands: plum overhead, blue at the horizon, a lit edge between.
    id: "dusk",
    name: "Dusk",
    group: "Light & color",
    image:
      "linear-gradient(180deg, transparent 61.5%, rgba(255,214,170,0.5) 62%, transparent 62.6%), " +
      "radial-gradient(60% 28% at 50% 63%, rgba(255,170,120,0.28), transparent 70%), " +
      "linear-gradient(180deg, #150c26 0%, #1b1440 34%, #16203f 58%, #070a14 100%)",
    color: "#070a14",
  },
  {
    // Two lights from the bottom corners, cyan against magenta.
    id: "neon",
    name: "Neon",
    group: "Light & color",
    image:
      "radial-gradient(60% 50% at 8% 104%, rgba(236,72,153,0.42), transparent 62%), " +
      "radial-gradient(60% 50% at 92% 104%, rgba(34,211,238,0.36), transparent 62%), " +
      "radial-gradient(90% 44% at 50% -8%, rgba(99,102,241,0.22), transparent 64%), " +
      "linear-gradient(180deg, #070a1a 0%, #04050e 100%)",
    color: "#04050e",
  },
  {
    // Charcoal with heat rising from the floor.
    id: "ember",
    name: "Ember",
    group: "Light & color",
    image:
      "radial-gradient(90% 46% at 50% 108%, rgba(249,115,22,0.34), transparent 62%), " +
      "radial-gradient(70% 36% at 50% 100%, rgba(239,68,68,0.24), transparent 62%), " +
      "linear-gradient(180deg, #14100e 0%, #0a0807 100%)",
    color: "#0a0807",
  },

  // ── Texture ─────────────────────────────────────────────────────────────
  {
    id: "stars",
    name: "Night sky",
    group: "Texture",
    image: `${STARS}, radial-gradient(70% 45% at 50% 8%, rgba(129,140,248,0.20), transparent 62%), linear-gradient(180deg, #070a18 0%, #03040c 100%)`,
    color: "#03040c",
    size: "600px 600px, cover, cover",
  },
  {
    id: "topo",
    name: "Contour",
    group: "Texture",
    image: `${TOPO}, radial-gradient(80% 55% at 50% -8%, ACCENT26, transparent 64%), linear-gradient(180deg, #0b1114, #06090c)`,
    color: "#06090c",
    size: "400px 400px, cover, cover",
  },
  {
    id: "mono",
    name: "Graphite",
    group: "Texture",
    image:
      "repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 15px), linear-gradient(180deg, #1d1d23, #0f0f13)",
    color: "#0f0f13",
  },
  {
    // Soft focus: three big shapes, the closest thing to a photo here.
    id: "blobs",
    name: "Soft focus",
    group: "Texture",
    image:
      "radial-gradient(34% 42% at 22% 26%, ACCENT4d, transparent 68%), " +
      "radial-gradient(30% 38% at 80% 34%, rgba(56,189,248,0.30), transparent 68%), " +
      "radial-gradient(38% 44% at 54% 92%, rgba(244,114,182,0.26), transparent 68%), " +
      "linear-gradient(180deg, #0c0a14, #08070e)",
    color: "#08070e",
  },

  // ── Pattern ─────────────────────────────────────────────────────────────
  {
    id: "dots",
    name: "Dotted",
    group: "Pattern",
    image: `${DOTS}, radial-gradient(80% 50% at 50% -10%, ACCENT33, transparent 66%), linear-gradient(180deg, #0c0912, #08060d)`,
    color: "#08060d",
    size: "26px 26px, cover, cover",
  },
  {
    id: "halftone",
    name: "Halftone",
    group: "Pattern",
    image: `${HALFTONE}, radial-gradient(90% 60% at 50% 0%, ACCENT33, transparent 68%), linear-gradient(180deg, #100c18, #09070f)`,
    color: "#09070f",
    size: "144px 144px, cover, cover",
  },
  {
    id: "grid",
    name: "Blueprint",
    group: "Pattern",
    image: `${GRID}, linear-gradient(180deg, rgba(59,130,246,0.16), transparent 62%), linear-gradient(180deg, #070c18, #050810)`,
    color: "#050810",
    size: "44px 44px, cover, cover",
  },
  {
    id: "rays",
    name: "Sunburst",
    group: "Pattern",
    image:
      "repeating-conic-gradient(from 188deg at 50% -12%, rgba(255,255,255,0.055) 0deg 5deg, transparent 5deg 11deg), " +
      "radial-gradient(70% 46% at 50% -6%, ACCENT40, transparent 64%), " +
      "linear-gradient(180deg, #0f0a16, #08060e)",
    color: "#08060e",
  },
  {
    id: "vinyl",
    name: "Grooves",
    group: "Pattern",
    image:
      "repeating-radial-gradient(circle at 50% 34%, rgba(255,255,255,0.05) 0 1px, transparent 1px 8px), " +
      "radial-gradient(28% 22% at 50% 34%, ACCENT59, transparent 70%), " +
      "linear-gradient(180deg, #0c0a11, #07060b)",
    color: "#07060b",
  },
  {
    id: "scan",
    name: "Scanlines",
    group: "Pattern",
    image:
      "repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 5px), " +
      "radial-gradient(80% 50% at 50% 0%, ACCENT33, transparent 66%), " +
      "linear-gradient(180deg, #0a1014, #05080b)",
    color: "#05080b",
  },
  {
    // Grid, faded out at the edges by a vignette sitting on top of it — the
    // pattern reads as a surface rather than as wallpaper.
    id: "gridfade",
    name: "Grid fade",
    group: "Pattern",
    image:
      "radial-gradient(70% 55% at 50% 12%, transparent 20%, #05060c 82%), " +
      `${GRID}, ` +
      "radial-gradient(60% 34% at 50% -4%, ACCENT40, transparent 66%), " +
      "linear-gradient(180deg, #080a12, #05060c)",
    color: "#05060c",
    size: "cover, 44px 44px, cover, cover",
  },
  {
    // A single wide arc of accent light — one geometric gesture, nothing else.
    id: "arc",
    name: "Arc",
    group: "Pattern",
    image:
      "radial-gradient(closest-side circle at 50% 118%, transparent 78%, ACCENT80 79%, ACCENT80 80.4%, transparent 81.4%), " +
      "radial-gradient(60% 40% at 50% 112%, ACCENT33, transparent 68%), " +
      "linear-gradient(180deg, #0a0912, #06060b)",
    color: "#06060b",
    size: "170% 170%, cover, cover",
    position: "center, center, center",
    repeat: "no-repeat, no-repeat, no-repeat",
  },

  // ── Bright ──────────────────────────────────────────────────────────────
  {
    // Warm off-white. Pages default to white text, so the picker flags these
    // and points at the text color control.
    id: "paper",
    name: "Paper",
    group: "Bright",
    image:
      "radial-gradient(90% 50% at 50% -10%, rgba(0,0,0,0.05), transparent 62%), " +
      "linear-gradient(180deg, #fdfbf6 0%, #f4efe6 100%)",
    color: "#f4efe6",
  },
  {
    id: "frost",
    name: "Frost",
    group: "Bright",
    image:
      "radial-gradient(70% 44% at 12% 0%, rgba(129,140,248,0.20), transparent 62%), " +
      "radial-gradient(70% 44% at 88% 8%, rgba(34,211,238,0.18), transparent 62%), " +
      "linear-gradient(180deg, #f7f9fd 0%, #e8eef7 100%)",
    color: "#e8eef7",
  },
  {
    // Accent-tinted bright, for creators whose brand is the colour itself.
    id: "wash",
    name: "Accent wash",
    group: "Bright",
    image:
      "radial-gradient(80% 50% at 50% -10%, ACCENT3d, transparent 66%), " +
      "linear-gradient(180deg, #ffffff 0%, #f2f2f6 100%)",
    color: "#f2f2f6",
  },
];

export function getThemeDef(id: string | undefined | null): ThemeDef | null {
  if (!id) return null;
  return THEMES.find((t) => t.id === id) ?? null;
}

/** CSS for a theme, with the site accent substituted in. */
export function themeCss(id: string | undefined | null, accent: string): CSSProperties | null {
  const t = getThemeDef(id);
  if (!t) return null;
  // "ACCENT55" → accent hex + alpha suffix (accent is "#rrggbb").
  const image = t.image.replace(/ACCENT([0-9a-f]{2})/g, `${accent}$1`).replace(/ACCENT/g, accent);
  const css: CSSProperties = { backgroundImage: image, backgroundColor: t.color };
  if (t.size) css.backgroundSize = t.size;
  if (t.position) css.backgroundPosition = t.position;
  if (t.repeat) css.backgroundRepeat = t.repeat;
  return css;
}

/**
 * Split a CSS list on its top-level commas only — the commas inside
 * `radial-gradient(...)` or a `url("data:...")` are part of a single layer.
 */
function splitLayers(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (const ch of value) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Materialize a background-size/position/repeat list to exactly `n` entries,
 * the way CSS itself does it: a shorter list repeats, an absent one is the
 * property's initial value.
 */
function padList(value: string | undefined, n: number, initial: string): string[] {
  const parts = value ? splitLayers(value) : [];
  if (parts.length === 0) return Array.from({ length: n }, () => initial);
  return Array.from({ length: n }, (_, i) => parts[i % parts.length]);
}

/** "ACCENT" / "ACCENT55" → the site accent, with the alpha suffix kept. */
function withAccent(image: string, accent: string): string {
  return image.replace(/ACCENT([0-9a-f]{2})/g, `${accent}$1`).replace(/ACCENT/g, accent);
}

export interface BackdropOpts {
  /** Preset id, or "" / null for none. */
  themeId?: string | null;
  accent: string;
  /** The creator's own base colour — always the bottom of the stack. */
  bgColor: string;
  /** Uploaded or generated image. */
  bgImage?: string | null;
  /** Accent glow at the top of the page (default on). */
  glow?: boolean;
  /** Glow geometry — the page uses pixels, the small preview percentages. */
  glowSize?: string;
}

/**
 * The whole page backdrop as one declaration.
 *
 * Layers, top to bottom: accent glow → the creator's image → the preset's own
 * layers → their base colour. A preset is one layer in that stack rather than
 * a mode, which is what lets the colour, image and glow controls keep working
 * while a preset is picked.
 *
 * background-size / -position / -repeat are comma lists matched positionally
 * to the layers, so anything prepended here has to prepend to all three as
 * well — most of the textured presets set them, and a shift would land their
 * values on the wrong layer.
 */
export function backdropCss(opts: BackdropOpts): CSSProperties {
  const layers: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  const repeats: string[] = [];

  const push = (image: string, size = "auto", position = "0% 0%", repeat = "no-repeat") => {
    layers.push(image);
    sizes.push(size);
    positions.push(position);
    repeats.push(repeat);
  };

  if (opts.glow !== false) {
    push(`radial-gradient(${opts.glowSize ?? "800px 400px"} at 50% -10%, ${opts.accent}33, transparent 70%)`);
  }
  if (opts.bgImage) push(`url("${opts.bgImage}")`, "cover", "center");

  const t = getThemeDef(opts.themeId);
  if (t) {
    const image = withAccent(t.image, opts.accent);
    const n = splitLayers(image).length;
    layers.push(image);
    sizes.push(...padList(t.size, n, "auto"));
    positions.push(...padList(t.position, n, "0% 0%"));
    repeats.push(...padList(t.repeat, n, "repeat"));
  }

  const css: CSSProperties = { backgroundColor: opts.bgColor };
  if (layers.length) {
    css.backgroundImage = layers.join(", ");
    css.backgroundSize = sizes.join(", ");
    css.backgroundPosition = positions.join(", ");
    css.backgroundRepeat = repeats.join(", ");
  }
  return css;
}
