import type { CSSProperties } from "react";

/**
 * Visual themes for creator pages — smooth gradients and SVG textures.
 * A theme can be applied site-wide (site.config.themeId) and overridden per
 * section (section.theme), where it renders as a themed container band.
 * "ACCENT" inside a definition is replaced with the site's accent color.
 */

export interface ThemeDef {
  id: string;
  name: string;
  /** background-image layers (gradients / SVG data URIs), comma separated. */
  image: string;
  color: string;
  size?: string;
  position?: string;
  repeat?: string;
}

function svg(markup: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}

const DOTS = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><circle cx='2' cy='2' r='1.5' fill='rgba(255,255,255,0.14)'/></svg>`
);

const GRID = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><path d='M44 0H0v44' fill='none' stroke='rgba(255,255,255,0.07)'/></svg>`
);

const WAVES = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320' preserveAspectRatio='none'><path fill='rgba(255,255,255,0.05)' d='M0,192L60,181.3C120,171,240,149,360,154.7C480,160,600,192,720,197.3C840,203,960,181,1080,165.3C1200,149,1320,139,1380,133.3L1440,128L1440,320L0,320Z'/><path fill='rgba(255,255,255,0.08)' d='M0,256L80,240C160,224,320,192,480,197.3C640,203,800,245,960,250.7C1120,256,1280,224,1360,208L1440,192L1440,320L0,320Z'/></svg>`
);

const BLOBS = svg(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><g fill='rgba(255,255,255,0.05)'><circle cx='120' cy='110' r='90'/><circle cx='500' cy='180' r='130'/><circle cx='280' cy='470' r='110'/></g></svg>`
);

export const THEMES: ThemeDef[] = [
  {
    id: "aurora",
    name: "Aurora",
    image:
      "radial-gradient(900px 480px at 15% -10%, rgba(52,211,153,0.28), transparent 65%), radial-gradient(900px 480px at 85% 0%, rgba(139,92,246,0.30), transparent 65%), radial-gradient(700px 500px at 50% 110%, rgba(34,211,238,0.18), transparent 70%)",
    color: "#070b14",
  },
  {
    id: "sunset",
    name: "Sunset",
    image:
      "linear-gradient(160deg, rgba(251,146,60,0.34) 0%, rgba(236,72,153,0.30) 45%, rgba(124,58,237,0.28) 100%)",
    color: "#160810",
  },
  {
    id: "ocean",
    name: "Ocean",
    image: `${WAVES}, linear-gradient(180deg, rgba(14,116,144,0.32), rgba(30,58,138,0.30))`,
    color: "#04101e",
    size: "100% 34%, cover",
    position: "bottom, center",
    repeat: "no-repeat, no-repeat",
  },
  {
    id: "candy",
    name: "Candy",
    image:
      "radial-gradient(700px 420px at 20% 15%, rgba(244,114,182,0.36), transparent 60%), radial-gradient(700px 420px at 80% 85%, rgba(167,139,250,0.34), transparent 60%)",
    color: "#150818",
  },
  {
    id: "forest",
    name: "Forest",
    image:
      "radial-gradient(800px 500px at 30% -10%, rgba(16,185,129,0.26), transparent 65%), radial-gradient(700px 420px at 90% 100%, rgba(101,163,13,0.16), transparent 65%)",
    color: "#06110c",
  },
  {
    id: "gold",
    name: "Gold",
    image:
      "radial-gradient(800px 460px at 50% -15%, rgba(250,204,21,0.22), transparent 62%), radial-gradient(600px 380px at 90% 110%, rgba(217,119,6,0.16), transparent 65%)",
    color: "#120d04",
  },
  {
    id: "prism",
    name: "Prism",
    image:
      "linear-gradient(120deg, rgba(56,189,248,0.24), transparent 40%), linear-gradient(240deg, rgba(244,114,182,0.24), transparent 40%), linear-gradient(0deg, rgba(163,230,53,0.14), transparent 55%)",
    color: "#0b0a16",
  },
  {
    id: "accent",
    name: "Accent Glow",
    image: "radial-gradient(900px 520px at 50% -10%, ACCENT55, transparent 65%)",
    color: "#0a0812",
  },
  {
    id: "dots",
    name: "Dotted",
    image: `${DOTS}, radial-gradient(800px 480px at 50% -10%, ACCENT33, transparent 65%)`,
    color: "#0b0912",
  },
  {
    id: "grid",
    name: "Blueprint",
    image: `${GRID}, linear-gradient(180deg, rgba(59,130,246,0.14), transparent 70%)`,
    color: "#080d18",
  },
  {
    id: "blobs",
    name: "Bubbles",
    image: `${BLOBS}, linear-gradient(200deg, ACCENT2e, transparent 70%)`,
    color: "#0d0a14",
    size: "cover, cover",
  },
  {
    id: "mono",
    name: "Graphite",
    image:
      "repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 14px), linear-gradient(180deg, #1c1c22, #101014)",
    color: "#101014",
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
