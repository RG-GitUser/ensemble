"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteLookAction, saveLookAction, updateTheme, type FormState } from "@/lib/actions";
import type { SavedLook } from "@/lib/types";
import {
  ACCENTS,
  BACKGROUNDS,
  BORDER_STYLES,
  borderCss,
  CONTAINER_SIZES,
  CONTAINERS,
  COLOR_MODES,
  type ColorMode,
  DEFAULT_BORDER,
  DEFAULT_SIZE,
  edgeForLight,
  isLight,
  LAYOUTS,
  LIGHT_BACKGROUNDS,
  LIGHT_CONTAINERS,
  MAX_LOOKS,
  normalizeHex,
  type Swatch,
} from "@/lib/theme";
import { backdropCss, BRIGHT_GROUP, getThemeDef, THEME_GROUPS, THEMES, themeCss } from "@/lib/themes";
import { FONTS, getFont, LIGHT_TEXT_COLORS, TEXT_COLORS, TEXT_SIZES } from "@/lib/fonts";
import { CloseIcon, ShuffleIcon } from "@/components/icons";

/** One titled block of related controls — the Design tab is a stack of these. */
function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card !p-5">
      <h3 className="font-bold">{title}</h3>
      {hint && <p className="mt-1 text-sm text-mist">{hint}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

/**
 * Type any hex, alongside the curated swatches.
 *
 * Just the text box: the color it produces shows up in the swatch row above,
 * in the same shape as every other option, and that swatch is itself the
 * native picker — so there's one place to look for "the color I chose"
 * instead of a second, differently-shaped preview inside the field.
 *
 * Only a complete, valid hex is committed, so half-typed input never repaints
 * the preview and the field isn't wiped while someone is still typing.
 */
function HexPicker({
  label,
  value,
  onPick,
  /** Overrides the default "too light for white text" caution. */
  warning,
}: {
  label: string;
  value: string;
  /** Receives the typed/picked color — see SwatchRow's `onPickCustom`. */
  onPick: (v: string) => void;
  warning?: string;
}) {
  const hex = normalizeHex(value);
  const [text, setText] = useState(hex);
  const caution =
    warning ?? (hex && isLight(hex) ? "Light color — your page text is white, so this may be hard to read." : "");
  // Swatch clicks and Randomize change the value from outside — follow along.
  useEffect(() => setText(normalizeHex(value)), [value]);

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 rounded-xl border border-edge bg-panel2 px-3 py-1.5">
        <span className="text-xs font-medium text-mist">Or paste a hex</span>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const normalized = normalizeHex(e.target.value);
            if (normalized) onPick(normalized);
          }}
          placeholder="#8b5cf6"
          spellCheck={false}
          maxLength={7}
          aria-label={`${label}: custom hex`}
          className="w-24 bg-transparent font-mono text-sm text-snow outline-none placeholder:text-mist/50"
        />
      </label>
      {caution && <p className="text-xs text-warn">{caution}</p>}
    </div>
  );
}

/** One backdrop preset, drawn at thumbnail size with its name underneath. */
function PresetTile({
  name,
  selected,
  onPick,
  style,
}: {
  name: string;
  selected: boolean;
  onPick: () => void;
  style: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      title={name}
      aria-pressed={selected}
      onClick={onPick}
      className={`overflow-hidden rounded-xl border text-left transition ${
        selected ? "border-brand ring-1 ring-brand" : "border-edge hover:border-brand/60"
      }`}
    >
      <div className="h-12 w-full" style={style} />
      <p className="truncate px-2 py-1 text-[10px] font-medium">{name}</p>
    </button>
  );
}

function SwatchRow({
  label,
  hint,
  swatches,
  value,
  onPick,
  /** Dark base composited under translucent swatches so they stay visible. */
  base,
  /** Adds the hex box — colors that end up as a plain background accept one. */
  custom,
  /**
   * Used instead of onPick for a typed or picked color. The backdrop needs
   * this: choosing your own color should give you that color and nothing
   * else, which means switching off the layers we add by default.
   */
  onPickCustom,
  warn,
}: {
  label: string;
  hint?: string;
  swatches: Swatch[];
  value: string;
  onPick: (v: string) => void;
  base?: string;
  custom?: boolean;
  onPickCustom?: (v: string) => void;
  /** Passed through to the hex box, replacing its default caution. */
  warn?: string;
}) {
  const customValue = !swatches.some((s) => s.value === value);
  const pickCustom = onPickCustom ?? onPick;
  return (
    <div>
      <span className="label !mb-0">{label}</span>
      {hint && <p className="mt-0.5 text-xs text-mist/70">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2.5">
        {swatches.map((s) => {
          const selected = value === s.value;
          return (
            <button
              key={s.id}
              type="button"
              title={s.label}
              aria-label={`${label}: ${s.label}`}
              aria-pressed={selected}
              onClick={() => onPick(s.value)}
              className={`flex h-9 items-center justify-center transition ${
                base
                  ? "w-14 rounded-xl border border-white/15 hover:border-mist"
                  : "w-9 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]"
              } ${selected ? "ring-2 ring-brand ring-offset-2 ring-offset-panel" : ""}`}
              style={
                base
                  ? { backgroundImage: `linear-gradient(${s.value}, ${s.value})`, backgroundColor: base }
                  : { background: s.value }
              }
            >
              {/* Container swatches are mini cards — the content bar makes the tint readable. */}
              {base && <span className="pointer-events-none block h-1.5 w-7 rounded-full bg-white/45" />}
            </button>
          );
        })}
        {/* A typed color is off-palette, so nothing above would read as
            selected — this swatch is where the current choice lives instead,
            and clicking it opens the OS color picker. `swatch-input` (in
            globals.css) strips the native chrome so the color fills the
            shape rather than sitting in a box inside it. */}
        {custom && customValue && (
          <input
            type="color"
            value={normalizeHex(value) || "#ffffff"}
            onChange={(e) => pickCustom(e.target.value)}
            title={`${value} — click to pick another`}
            aria-label={`${label}: custom color`}
            className={`swatch-input h-9 cursor-pointer ring-2 ring-brand ring-offset-2 ring-offset-panel ${
              base ? "w-14 rounded-xl" : "w-9 rounded-full"
            }`}
            style={{ backgroundColor: value }}
          />
        )}
      </div>
      {custom && <HexPicker label={label} value={value} onPick={pickCustom} warning={warn} />}
    </div>
  );
}

/** Typeface picker — every tile is set in the face it offers. */
function FontRow({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  return (
    <div>
      <span className="label !mb-0">Font</span>
      <p className="mt-0.5 text-xs text-mist/70">
        Sets the whole page — headings and body. Each name below is shown in its own face.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FONTS.map((f) => {
          const selected = value === f.id;
          return (
            <button
              key={f.id || "default"}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(f.id)}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                selected ? "border-brand ring-1 ring-brand" : "border-edge hover:border-brand/60"
              }`}
            >
              <span className="block truncate text-base" style={{ fontFamily: f.family }}>
                {f.label}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-mist">{f.note}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Text size — each tile sets its own label at the size it would produce. */
function TextSizeRow({ value, onPick, family }: { value: string; onPick: (v: string) => void; family: string }) {
  return (
    <div>
      <span className="label !mb-0">Text size</span>
      <p className="mt-0.5 text-xs text-mist/70">
        Scales every piece of text on the page together, so the proportions you picked stay put.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {TEXT_SIZES.map((s) => {
          const selected = value === s.value;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(s.value)}
              className={`w-[5.5rem] rounded-xl border px-2 py-2 transition ${
                selected ? "border-brand ring-1 ring-brand" : "border-edge hover:border-brand/60"
              }`}
            >
              <span className="flex h-7 items-center justify-center">
                <span style={{ fontFamily: family, fontSize: `calc(1.1rem * ${s.value})` }}>Aa</span>
              </span>
              <span className="mt-1 block text-center text-[10px] font-medium">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Layout picker — each tile is a small drawing of the arrangement it makes. */
function LayoutRow({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  const bar = "rounded-[3px] bg-mist/35";
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-3">
        {LAYOUTS.map((l) => {
          const selected = value === l.id;
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(l.id)}
              className={`rounded-xl border p-3 text-left transition ${
                selected ? "border-brand ring-1 ring-brand" : "border-edge hover:border-brand/60"
              }`}
            >
              {/* The diagram carries the idea faster than the sentence does. */}
              <span className="flex h-14 flex-col justify-center gap-1.5 rounded-lg bg-panel2 p-2">
                {l.id === "scroll" && (
                  <>
                    <span className={`${bar} h-2.5 w-full`} />
                    <span className={`${bar} h-2.5 w-full`} />
                    <span className={`${bar} h-2.5 w-full`} />
                  </>
                )}
                {l.id === "side" && (
                  <>
                    <span className={`${bar} h-2.5 w-full`} />
                    <span className="flex gap-1.5">
                      <span className={`${bar} h-5 w-1/2`} />
                      <span className={`${bar} h-5 w-1/2`} />
                    </span>
                  </>
                )}
                {l.id === "stagger" && (
                  <>
                    <span className={`${bar} h-2.5 w-3/4`} />
                    <span className={`${bar} ml-auto h-2.5 w-3/4`} />
                    <span className={`${bar} h-2.5 w-3/4`} />
                  </>
                )}
              </span>
              <span className="mt-2 block text-xs font-semibold">{l.label}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-mist">{l.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The body of the live preview: mock sections drawn in the chosen
 * arrangement.
 *
 * These are drawn rather than sharing the page's own `.site-layout-*` rules
 * on purpose — those rules key off the viewport, so inside a 24rem column
 * side-by-side and staggered would both collapse to a single column and the
 * preview would show nothing at all. Same shapes, scaled to fit.
 */
function PreviewSections({
  layout,
  cardStyle,
  width,
}: {
  layout: string;
  cardStyle: React.CSSProperties;
  /** Container width setting, as a percentage of the widest option. */
  width: string;
}) {
  const Card = ({ title, sub, style }: { title: string; sub: string; style?: React.CSSProperties }) => (
    <div className="rounded-xl p-3" style={{ ...cardStyle, ...style }}>
      <p className="text-[0.85em] font-semibold leading-snug">{title}</p>
      <p className="mt-0.5 text-[0.72em] leading-snug opacity-70">{sub}</p>
    </div>
  );

  if (layout === "side") {
    return (
      <div className="mt-5 space-y-3" style={{ width, marginInline: "auto" }}>
        <div className="grid grid-cols-2 gap-3">
          <Card title="Featured video" sub="Your latest" />
          <Card title="About me" sub="Your story" />
          <Card title="Bonus content" sub="Early access" />
          <Card title="Merch" sub="Columns narrow to fit" />
          <Card title="Links" sub="Everywhere else" />
          <Card title="Contact" sub="For brands" />
        </div>
        <Card title="Footer" sub="Full width — it closes the page" />
      </div>
    );
  }

  if (layout === "stagger") {
    return (
      <div className="mt-5 space-y-3" style={{ width, marginInline: "auto" }}>
        <Card title="Featured video" sub="Your latest" style={{ width: "80%" }} />
        <Card title="About me" sub="Your story" style={{ width: "80%", marginLeft: "20%" }} />
        <Card title="Bonus content" sub="Early access" style={{ width: "80%" }} />
        <Card title="Links" sub="Everywhere else" style={{ width: "80%", marginLeft: "20%" }} />
        <Card title="Footer" sub="Full width — it closes the page" />
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3" style={{ width, marginInline: "auto" }}>
      <Card title="Featured video" sub="Your latest" />
      <Card title="Bonus content" sub="Drops, behind the scenes, early access" />
      <Card title="Merch" sub="Sell straight from the page" />
      <Card title="Links" sub="Find me everywhere" />
    </div>
  );
}

/** Width picker — each tile draws its option to scale, widest option full. */
function SizeRow({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  const widest = Math.max(...CONTAINER_SIZES.map((s) => Number(s.value)));
  return (
    <div>
      <span className="label !mb-0">Container width</span>
      <p className="mt-0.5 text-xs text-mist/70">
        How wide your sections run. Every section scales together, so a links list stays narrower than a merch grid.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {CONTAINER_SIZES.map((s) => {
          const selected = value === s.value;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(s.value)}
              className={`w-[4.5rem] rounded-xl border px-2 py-2 transition ${
                selected ? "border-brand ring-1 ring-brand" : "border-edge hover:border-brand/60"
              }`}
            >
              <span className="flex h-7 items-center justify-center">
                <span
                  className="block h-full rounded-md bg-mist/25 shadow-[inset_0_0_0_1px_var(--hairline)]"
                  style={{ width: `${(Number(s.value) / widest) * 100}%` }}
                />
              </span>
              <span className="mt-1.5 block text-center text-[10px] font-medium">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Border picker — each tile is a miniature container wearing the style. */
function BorderRow({
  value,
  onPick,
  accent,
  card,
  base,
}: {
  value: string;
  onPick: (v: string) => void;
  accent: string;
  card: string;
  /** Page background, composited under translucent container tints. */
  base: string;
}) {
  return (
    <div>
      <span className="label !mb-0">Border accent</span>
      <p className="mt-0.5 text-xs text-mist/70">The edge treatment on every container, drawn in your accent color.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {BORDER_STYLES.map((b) => {
          const selected = value === b.id;
          return (
            <button
              key={b.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(b.id)}
              className={`w-[5.5rem] rounded-xl border p-2 transition ${
                selected ? "border-brand ring-1 ring-brand" : "border-edge hover:border-brand/60"
              }`}
            >
              <span
                className="flex h-9 items-center justify-center rounded-lg"
                style={{
                  backgroundImage: `linear-gradient(${card}, ${card})`,
                  backgroundColor: base,
                  ...borderCss(b.id, accent),
                }}
              >
                <span className="block h-1.5 w-8 rounded-full bg-white/45" />
              </span>
              <span className="mt-1.5 block truncate text-center text-[10px] font-medium">{b.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A genuinely random abstract blob background in the given colors. */
function generateSvg(colors: string[]): string {
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = () => colors[Math.floor(Math.random() * colors.length)];
  let shapes = "";
  const count = Math.floor(rnd(4, 8));
  for (let i = 0; i < count; i++) {
    shapes += `<circle cx="${rnd(0, 1600).toFixed(0)}" cy="${rnd(0, 900).toFixed(0)}" r="${rnd(140, 420).toFixed(0)}" fill="${pick()}" opacity="${rnd(0.1, 0.28).toFixed(2)}"/>`;
  }
  const blur = rnd(50, 100).toFixed(0);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">` +
    `<filter id="b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${blur}"/></filter>` +
    `<g filter="url(#b)">${shapes}</g></svg>`
  );
}

function randomOf<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * The page builder's Design tab.
 *
 * Grouped the way the page is built up: the backdrop behind everything, then
 * the containers sitting on it, then the accent that ties them together, then
 * branding. The preview and the save button ride along in a sticky column, so
 * whichever group you're editing you can see the result and commit it.
 */
export function ThemeForm({
  themeColor,
  bgColor,
  cardColor,
  containerSize,
  borderStyle,
  bgImage,
  cardImage,
  faviconUrl,
  gradient: gradientProp,
  themeId: themeIdProp,
  fontId: fontIdProp,
  fontScale: fontScaleProp,
  textColor: textColorProp,
  layout: layoutProp,
  colorMode: colorModeProp,
  lightBgColor,
  lightCardColor,
  lightTextColor,
  lightThemeId: lightThemeIdProp,
  looks,
  slug,
}: {
  themeColor: string;
  bgColor: string;
  cardColor: string;
  /** Container width multiplier (CONTAINER_SIZES value). */
  containerSize: string;
  /** Container border treatment (BORDER_STYLES id). */
  borderStyle: string;
  bgImage: string;
  cardImage: string;
  /** Current browser tab icon for the public page ("" = Ensemble default). */
  faviconUrl: string;
  gradient: boolean;
  /** Active preset backdrop id ("" = custom/Midnight). */
  themeId: string;
  /** Typeface id from lib/fonts.ts ("" = Geist). */
  fontId: string;
  /** Text size multiplier (TEXT_SIZES value). */
  fontScale: string;
  /** Page text color. */
  textColor: string;
  /** Section arrangement (LAYOUTS id). */
  layout: string;
  /** Whether the page is dark, light, or the visitor's choice. */
  colorMode: ColorMode;
  lightBgColor: string;
  lightCardColor: string;
  lightTextColor: string;
  /** Preset backdrop used in light mode ("" = follow the dark one). */
  lightThemeId: string;
  /** Named design snapshots saved on this site. */
  looks: SavedLook[];
  /** Page slug, for the link out to the real page. */
  slug: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateTheme, {});
  const [accent, setAccent] = useState(themeColor);
  const [bg, setBg] = useState(bgColor);
  const [card, setCard] = useState(cardColor);
  const [size, setSize] = useState(containerSize);
  const [border, setBorder] = useState(borderStyle);
  const [gradient, setGradient] = useState(gradientProp);
  const [themeId, setThemeId] = useState(themeIdProp);
  const [fontId, setFontId] = useState(fontIdProp);
  const [scale, setScale] = useState(fontScaleProp);
  const [ink, setInk] = useState(textColorProp);
  const [layout, setLayout] = useState(layoutProp);
  const [colorMode, setColorMode] = useState<ColorMode>(colorModeProp);
  const [lightBg, setLightBg] = useState(lightBgColor);
  const [lightCard, setLightCard] = useState(lightCardColor);
  const [lightInk, setLightInk] = useState(lightTextColor);
  const [lightThemeId, setLightThemeId] = useState(lightThemeIdProp);
  /** Which palette the preview is showing — editing aid only, never saved. */
  const [previewMode, setPreviewMode] = useState<"dark" | "light">("dark");
  const [lookName, setLookName] = useState("");
  const [lookState, lookAction, lookPending] = useActionState<FormState, FormData>(saveLookAction, {});
  /** What the preview shows: saved URL, object URL of a picked file, or a generated data URI. */
  const [bgImg, setBgImg] = useState<string>(bgImage);
  const [cardImg, setCardImg] = useState<string>(cardImage);
  /** Pending generated SVG markup, submitted for server-side storage. */
  const [bgSvg, setBgSvg] = useState("");
  const [icon, setIcon] = useState<string>(faviconUrl);
  const [clearBg, setClearBg] = useState(false);
  const [clearCard, setClearCard] = useState(false);
  const [clearIcon, setClearIcon] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const cardFileRef = useRef<HTMLInputElement>(null);
  const iconFileRef = useRef<HTMLInputElement>(null);

  // After a successful save the generated SVG is stored server-side — drop the
  // pending copy so re-saving doesn't write a duplicate file.
  useEffect(() => {
    if (state.ok) setBgSvg("");
  }, [state]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>, which: "bg" | "card") {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    if (which === "bg") {
      setBgImg(url);
      setBgSvg("");
      setClearBg(false);
    } else {
      setCardImg(url);
      setClearCard(false);
    }
  }

  function rollSvg(accentColor: string = accent) {
    // The given accent plus two random accents — random shapes, random blur.
    const svg = generateSvg([accentColor, randomOf(ACCENTS).value, randomOf(ACCENTS).value, "#ffffff"]);
    setBgSvg(svg);
    setBgImg(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
    setClearBg(false);
    // The preset stays: a rolled SVG layers over it, which is usually the more
    // interesting result and is one click to undo either way.
    if (bgFileRef.current) bgFileRef.current.value = "";
  }

  /** Roll everything: colors, container styling AND a fresh random SVG background. */
  function rollAll() {
    const newAccent = randomOf(ACCENTS).value;
    setAccent(newAccent);
    // "Roll everything" includes the preset — and sometimes rolls it off.
    setThemeId(randomOf([...THEMES, { id: "" }]).id);
    setBg(randomOf(BACKGROUNDS).value);
    setCard(randomOf(CONTAINERS).value);
    setSize(randomOf(CONTAINER_SIZES).value);
    setBorder(randomOf(BORDER_STYLES).id);
    rollSvg(newAccent);
  }

  /**
   * A typed background color is a statement: that color, on its own. So it
   * also clears the two layers that would otherwise sit on top of it — the
   * accent overlay and any background image — rather than quietly painting
   * over the color the creator just chose. Both are one click to restore,
   * and nothing is written until Save.
   */
  function useOwnColor(color: string) {
    setBg(color);
    setGradient(false);
    setBgImg("");
    setBgSvg("");
    setClearBg(true);
    // The preset stays put. It no longer owns the backdrop, so the typed color
    // takes effect underneath it — and dropping someone's preset because they
    // reached for the color picker would be the surprising move now.
    if (bgFileRef.current) bgFileRef.current.value = "";
  }

  function removeImage(which: "bg" | "card") {
    if (which === "bg") {
      setBgImg("");
      setBgSvg("");
      setClearBg(true);
      if (bgFileRef.current) bgFileRef.current.value = "";
    } else {
      setCardImg("");
      setClearCard(true);
      if (cardFileRef.current) cardFileRef.current.value = "";
    }
  }

  // url() values MUST be quoted: data URIs keep raw parentheses (e.g. the
  // SVG's filter="url(#b)"), which would otherwise cut the whole background
  // declaration short and silently kill every layer, glow included.
  // Sized in percentages, not pixels: the page's glow is 800x400 on a ~1280
  // viewport, so a fixed 280x150 in a 24rem preview column was both the wrong
  // proportion and mostly clipped above the box — switching the overlay on
  // and off changed almost nothing you could see.
  // Exactly what the page will render — same helper, only the glow geometry
  // differs, because 800x400px in a 24rem column is the wrong proportion and
  // mostly clipped above the box.
  // The preview renders whichever palette is being looked at, so the light
  // one is designed against the real thing rather than imagined.
  const lit = previewMode === "light" && colorMode !== "dark";
  const previewStyle = backdropCss({
    themeId: lit ? lightThemeId || themeId : themeId,
    accent,
    bgColor: lit ? lightBg : bg,
    bgImage: bgImg,
    glow: gradient,
    glowSize: "62% 44%",
  });
  /** Everything the Design tab owns, exactly as it stands right now. */
  const currentDesign = {
    themeColor: accent,
    bgColor: bg,
    cardColor: card,
    containerSize: size,
    borderStyle: border,
    bgImage: bgImg,
    cardImage: cardImg,
    gradient,
    themeId,
    fontId,
    fontScale: scale,
    textColor: ink,
    layout,
    colorMode,
    lightBgColor: lightBg,
    lightCardColor: lightCard,
    lightTextColor: lightInk,
    lightThemeId,
  };

  /** Load a saved look into the form. Nothing is written until Save. */
  function applyLook(l: SavedLook) {
    const d = l.design;
    if (d.themeColor) setAccent(d.themeColor);
    if (d.bgColor) setBg(d.bgColor);
    if (d.cardColor) setCard(d.cardColor);
    if (d.containerSize) setSize(d.containerSize);
    if (d.borderStyle) setBorder(d.borderStyle);
    if (d.fontId !== undefined) setFontId(d.fontId);
    if (d.fontScale) setScale(d.fontScale);
    if (d.textColor) setInk(d.textColor);
    if (d.layout) setLayout(d.layout);
    if (d.colorMode) setColorMode(d.colorMode);
    if (d.lightBgColor) setLightBg(d.lightBgColor);
    if (d.lightCardColor) setLightCard(d.lightCardColor);
    if (d.lightTextColor) setLightInk(d.lightTextColor);
    setThemeId(d.themeId ?? "");
    setLightThemeId(d.lightThemeId ?? "");
    setGradient(d.gradient !== false);
    // Images are files on the site, not part of the palette — a look only
    // restores one if it's still the image the site has.
    setBgImg(d.bgImage ?? "");
    setClearBg(!d.bgImage);
    setBgSvg("");
  }

  const previewInk = lit ? lightInk : ink;
  const previewCardStyle = {
    background: `${cardImg ? `url("${cardImg}") center / cover no-repeat, ` : ""}${lit ? lightCard : card}`,
    ...borderCss(border, accent),
    // Container edges are authored for a dark page — the public page flips
    // them for light mode, so the preview has to as well.
    ...(lit
      ? {
          borderColor: edgeForLight(borderCss(border, accent).borderColor as string),
          borderLeftColor: edgeForLight(borderCss(border, accent).borderLeftColor as string),
        }
      : {}),
  };
  /** Thumbnail for the "Custom" preset tile — reflects the current custom picks. */
  const customTileStyle = {
    backgroundImage: `${gradient ? `radial-gradient(62% 44% at 50% -10%, ${accent}55, transparent 70%), ` : ""}${
      bgImg ? `url("${bgImg}") center / cover no-repeat` : "none"
    }`,
    backgroundColor: bg,
  };
  /** The preview card apes the chosen width against the widest option. */
  const widest = Math.max(...CONTAINER_SIZES.map((s) => Number(s.value)));
  const previewCardWidth = `${(Number(size) / widest) * 100}%`;
  /** What the text actually sits on, so the ink can be checked against it. */
  const backdropBase = (themeId ? getThemeDef(themeId)?.color : bg) || bg;

  return (
    <>
      <form action={formAction} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <input type="hidden" name="themeColor" value={accent} />
      <input type="hidden" name="bgColor" value={bg} />
      <input type="hidden" name="cardColor" value={card} />
      <input type="hidden" name="containerSize" value={size} />
      <input type="hidden" name="borderStyle" value={border} />
      <input type="hidden" name="themeId" value={themeId} />
      <input type="hidden" name="fontId" value={fontId} />
      <input type="hidden" name="fontScale" value={scale} />
      <input type="hidden" name="textColor" value={ink} />
      <input type="hidden" name="layout" value={layout} />
      <input type="hidden" name="colorMode" value={colorMode} />
      <input type="hidden" name="lightBgColor" value={lightBg} />
      <input type="hidden" name="lightCardColor" value={lightCard} />
      <input type="hidden" name="lightTextColor" value={lightInk} />
      <input type="hidden" name="lightThemeId" value={lightThemeId} />
      <input type="hidden" name="bgSvg" value={bgSvg} />
      <input type="hidden" name="clearBgImage" value={clearBg ? "1" : ""} />
      <input type="hidden" name="clearCardImage" value={clearCard ? "1" : ""} />
      <input type="hidden" name="clearFavicon" value={clearIcon ? "1" : ""} />

      <div className="space-y-5">
        {/* 0 — Looks you've already built. Its controls belong to the sibling
            form below, wired up by id so they can sit here without nesting. */}
        <Group
          title="Saved looks"
          hint="Keep a design you like and come back to it. Applying one loads it into this tab — nothing changes on your page until you save."
        >
          {looks.length === 0 ? (
            <p className="text-xs text-mist/70">
              Nothing saved yet. Design something below, name it, and it&apos;ll be one click away.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {looks.map((l) => (
                <li key={l.id} className="flex items-center gap-2 rounded-xl border border-edge bg-panel2 p-2">
                  <span
                    aria-hidden
                    className="h-9 w-12 shrink-0 rounded-lg border border-white/15"
                    style={backdropCss({
                      themeId: l.design.themeId,
                      accent: l.design.themeColor ?? accent,
                      bgColor: l.design.bgColor ?? bg,
                      glow: l.design.gradient !== false,
                      glowSize: "80% 60%",
                    })}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</span>
                  <button type="button" onClick={() => applyLook(l)} className="btn-ghost !px-2.5 !py-1 text-xs">
                    Apply
                  </button>
                  <button
                    type="submit"
                    form="look-delete"
                    name="lookId"
                    value={l.id}
                    className="text-xs font-semibold text-mist transition hover:text-brand2"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              form="look-save"
              name="lookName"
              value={lookName}
              onChange={(e) => setLookName(e.target.value)}
              maxLength={40}
              placeholder="Name this look — e.g. Summer tour"
              className="field flex-1 !py-2 text-sm"
            />
            {/* Carries the on-screen design across to the other form. */}
            <input form="look-save" type="hidden" name="lookDesign" value={JSON.stringify(currentDesign)} />
            <button
              form="look-save"
              className="btn-ghost !py-2 text-sm"
              disabled={lookPending || !lookName.trim() || (looks.length >= MAX_LOOKS && !looks.some((l) => l.name.toLowerCase() === lookName.trim().toLowerCase()))}
            >
              {lookPending ? "Saving…" : "Save current look"}
            </button>
            <span className="text-xs text-mist/60">
              {looks.length}/{MAX_LOOKS}
            </span>
          </div>
          {lookState.error && <p className="text-xs text-brand2">{lookState.error}</p>}
          {lookState.ok && <p className="text-xs font-semibold text-good">Look saved.</p>}
        </Group>

        {/* 1 — What sits behind everything. */}
        <Group title="Backdrop" hint="The canvas your whole page sits on. Start from a preset or build your own.">
          <div>
            <span className="label !mb-0">Preset</span>
            <p className="mt-0.5 text-xs text-mist/70">
              A complete backdrop look — {THEMES.length} of them. Pick <span className="text-snow">Custom</span> to
              design your own with the controls below.
            </p>
            {/* Grouped by what the look is made of, so twenty tiles stay
                scannable: light and color, then textures, then patterns. */}
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {/* Named for what it does, not for what it isn't: this is the
                  tile that hands the backdrop back to the controls below. */}
              <PresetTile
                name="My colors"
                selected={themeId === ""}
                onPick={() => setThemeId("")}
                style={customTileStyle}
              />
            </div>
            {THEME_GROUPS.map((g) => (
              <div key={g} className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-mist/60">
                  {g}
                  {g === BRIGHT_GROUP && (
                    <span className="ml-2 font-medium normal-case tracking-normal text-mist/50">
                      set a dark text color under Type
                    </span>
                  )}
                </p>
                <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {THEMES.filter((t) => t.group === g).map((t) => (
                    <PresetTile
                      key={t.id}
                      name={t.name}
                      selected={themeId === t.id}
                      onPick={() => setThemeId(t.id)}
                      style={themeCss(t.id, accent)!}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* A preset is now just the bottom layer of the stack, so this is a
              status line rather than a warning: what's underneath, and one
              click to drop it. */}
          {themeId ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-panel2 px-4 py-3">
              <span
                aria-hidden
                className="h-9 w-14 shrink-0 rounded-lg border border-white/15"
                style={themeCss(themeId, accent) ?? undefined}
              />
              <p className="min-w-0 flex-1 text-xs text-mist">
                Starting from <span className="font-semibold text-snow">{THEMES.find((t) => t.id === themeId)?.name}</span>
                . Everything below still applies on top of it — your background color sits underneath, and your image and
                overlay layer over it.
              </p>
              <button type="button" onClick={() => setThemeId("")} className="btn-ghost shrink-0 !px-3 !py-1.5 text-xs">
                Remove preset
              </button>
            </div>
          ) : null}

          <div>
            <SwatchRow
              label="Background color"
              hint={
                themeId
                  ? "Sits underneath the preset — it shows through wherever the preset is translucent."
                  : "Paste a hex and your page is exactly that color — no overlay, no image. Add either back below."
              }
              swatches={BACKGROUNDS}
              value={bg}
              onPick={setBg}
              custom
              onPickCustom={useOwnColor}
            />
          </div>

          <div>
            <span className="label !mb-0">Background image</span>
            <p className="mt-0.5 text-xs text-mist/70">
              {themeId
                ? "Optional — layers over the preset. Upload your own SVG or image, or roll a random abstract SVG in your colors."
                : "Optional — sits on top of your background color. Upload your own SVG or image, or roll a random abstract SVG in your colors."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="btn-ghost cursor-pointer !py-2 text-sm">
                {bgImg ? "Replace" : "Upload image"}
                <input
                  ref={bgFileRef}
                  type="file"
                  name="bgImageFile"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg"
                  className="hidden"
                  onChange={(e) => onPickFile(e, "bg")}
                />
              </label>
              <button
                type="button"
                onClick={() => rollSvg()}
                className="btn-ghost inline-flex items-center gap-1.5 !py-2 text-sm"
              >
                <ShuffleIcon /> Random SVG
              </button>
              {bgImg && (
                <button type="button" onClick={() => removeImage("bg")} className="btn-ghost !py-2 text-sm !text-brand2">
                  Remove
                </button>
              )}
            </div>
            {/* Until now an applied image was invisible in these controls —
                the only clue was the preview, where a rolled SVG reads as a
                glow rather than as "an image I added". Show the thing. */}
            {bgImg && (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-edge bg-panel2/60 p-2">
                <span
                  className="block h-10 w-16 shrink-0 rounded-lg border border-edge"
                  style={{ background: `url("${bgImg}") center / cover no-repeat, ${bg}` }}
                />
                <p className="min-w-0 flex-1 text-xs text-mist">
                  An image is sitting on top of your background color. Remove it to see the color on its own.
                </p>
              </div>
            )}
          </div>

          {/* The glow is a layer we add on top, so it's stated as one: a
              choice between the flat color and the color with a wash over it.
              Typing your own color turns it off, because "my color" means
              that color — this row is how you put it back. */}
          <div>
            <span className="label !mb-0">Overlay</span>
            <p className="mt-0.5 text-xs text-mist/70">
              An optional wash of your accent color over the top of your background.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { on: false, label: "None", sub: bgImg ? "Color and image only" : "Just your color" },
                { on: true, label: "Accent glow", sub: "Tinted at the top" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={gradient === o.on}
                  onClick={() => setGradient(o.on)}
                  className={`w-[8.5rem] overflow-hidden rounded-xl border text-left transition ${
                    gradient === o.on ? "border-brand ring-1 ring-brand" : "border-edge hover:border-brand/60"
                  }`}
                >
                  {/* Both tiles carry every layer the page will actually draw —
                      image included — so the only difference between them is
                      the one thing they're choosing between. Drawing "None" as
                      a flat colour promised a page nobody was going to get. */}
                  <span
                    className="block h-10 w-full"
                    style={{
                      background: `${
                        o.on ? `radial-gradient(70px 34px at 50% -10%, ${accent}88, transparent 70%), ` : ""
                      }${bgImg ? `url("${bgImg}") center / cover no-repeat, ` : ""}${bg}`,
                    }}
                  />
                  <span className="block px-2 py-1.5">
                    <span className="block text-[11px] font-semibold">{o.label}</span>
                    <span className="block text-[10px] text-mist">{o.sub}</span>
                  </span>
                </button>
              ))}
            </div>
            {/* The image is set further down the page, but this is where people
                look when the backdrop isn't the flat colour they chose. */}
            {bgImg && (
              <p className="mt-2 text-xs text-mist">
                A background image is also covering your color.{" "}
                <button
                  type="button"
                  onClick={() => removeImage("bg")}
                  className="font-semibold text-brand2 underline underline-offset-2"
                >
                  Remove the image
                </button>{" "}
                to see <span className="font-mono text-snow">{normalizeHex(bg) || bg}</span> on its own.
              </p>
            )}
          </div>
          {/* The form still submits the same field the action reads. */}
          <input type="hidden" name="gradient" value={gradient ? "on" : ""} />
        </Group>

        {/* 1b — Whether the page has a second palette at all. */}
        <Group
          title="Light & dark"
          hint="Your page is dark by default. Offer a light version too, or let visitors pick."
        >
          <div>
            <span className="label !mb-0">Mode</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {COLOR_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setColorMode(m.id);
                    // Nothing to preview in the other palette when there isn't one.
                    if (m.id === "dark") setPreviewMode("dark");
                    if (m.id === "light") setPreviewMode("light");
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    colorMode === m.id ? "border-brand bg-brand/10" : "border-edge bg-panel2 hover:border-brand/40"
                  }`}
                >
                  <span className="block text-sm font-semibold">{m.name}</span>
                  <span className="mt-0.5 block text-xs text-mist">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {colorMode === "dark" ? (
            <p className="text-xs text-mist/70">
              Everything else on this tab is your dark look. Switch to light or visitor&apos;s choice to design a second
              palette.
            </p>
          ) : (
            <>
              <p className="text-xs text-mist/70">
                {colorMode === "auto"
                  ? "Visitors get whichever matches their device, and a switch in the corner of your page to change it. Your accent, type, layout and container shape are shared — only these colors differ."
                  : "Your page uses these colors instead of the dark ones above. Accent, type, layout and container shape are shared."}
              </p>
              <SwatchRow
                label="Light background"
                hint="The base color under everything in light mode."
                swatches={LIGHT_BACKGROUNDS}
                value={lightBg}
                onPick={setLightBg}
                custom
              />
              <SwatchRow
                label="Light container color"
                hint="The tint of every card and panel in light mode."
                swatches={LIGHT_CONTAINERS}
                value={lightCard}
                onPick={setLightCard}
                base={lightBg}
                custom
              />
              <SwatchRow
                label="Light text color"
                hint="Your words in light mode — the softer tones are mixed from it."
                swatches={LIGHT_TEXT_COLORS}
                value={lightInk}
                onPick={setLightInk}
                custom
                warn={
                  isLight(lightInk) === isLight(lightBg)
                    ? "This is about as bright as your light background — your words will be hard to read on it."
                    : undefined
                }
              />
              <div>
                <span className="label !mb-0">Light preset</span>
                <p className="mt-0.5 text-xs text-mist/70">
                  Optional — a different backdrop for light mode. Leave it on{" "}
                  <span className="text-snow">Same as dark</span> to reuse the one above.
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  <PresetTile
                    name="Same as dark"
                    selected={lightThemeId === ""}
                    onPick={() => setLightThemeId("")}
                    style={themeCss(themeId, accent) ?? { backgroundColor: bg }}
                  />
                  {THEMES.map((t) => (
                    <PresetTile
                      key={t.id}
                      name={t.name}
                      selected={lightThemeId === t.id}
                      onPick={() => setLightThemeId(t.id)}
                      style={themeCss(t.id, accent)!}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </Group>

        {/* 2 — The boxes your content lives in. */}
        <Group title="Containers" hint="The cards and panels each section sits in — their tint, width and edges.">
          <SwatchRow
            label="Container color"
            hint="Shown over your backdrop, so the translucent tints pick up whatever is behind them. A pasted hex is solid — it covers the backdrop rather than tinting it."
            swatches={CONTAINERS}
            value={card}
            onPick={setCard}
            base={bg}
            custom
          />
          <SizeRow value={size} onPick={setSize} />
          <BorderRow value={border} onPick={setBorder} accent={accent} card={card} base={bg} />

          <div>
            <span className="label !mb-0">Container image</span>
            <p className="mt-0.5 text-xs text-mist/70">Optional texture behind your cards&apos; tint.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="btn-ghost cursor-pointer !py-2 text-sm">
                {cardImg ? "Replace" : "Upload image"}
                <input
                  ref={cardFileRef}
                  type="file"
                  name="cardImageFile"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg"
                  className="hidden"
                  onChange={(e) => onPickFile(e, "card")}
                />
              </label>
              {cardImg && (
                <button
                  type="button"
                  onClick={() => removeImage("card")}
                  className="btn-ghost !py-2 text-sm !text-brand2"
                >
                  Remove
                </button>
              )}
            </div>
            {cardImg && (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-edge bg-panel2/60 p-2">
                <span
                  className="block h-10 w-16 shrink-0 rounded-lg border border-edge"
                  style={{ background: `url("${cardImg}") center / cover no-repeat, ${card}` }}
                />
                <p className="min-w-0 flex-1 text-xs text-mist">
                  A texture is sitting behind your container tint.
                </p>
              </div>
            )}
          </div>
        </Group>

        {/* 3 — The one color that touches everything. Directly under the
            containers it draws the borders on, so the pair is chosen together. */}
        <Group title="Accent" hint="Buttons, links, highlights and the accent border styles above.">
          <SwatchRow label="Accent color" swatches={ACCENTS} value={accent} onPick={setAccent} custom />
        </Group>

        {/* 4 — How the containers are arranged on the page. */}
        <Group
          title="Change container layout"
          hint="Where your sections sit. Your content doesn't move — only the arrangement does, so you can switch back any time."
        >
          <LayoutRow value={layout} onPick={setLayout} />
          {layout !== "scroll" && (
            <p className="rounded-xl bg-panel2 px-4 py-2.5 text-xs text-mist">
              Your hero, merch grid and video always run full width — they don&apos;t read well in half a column. On
              phones every layout stacks into one column.
            </p>
          )}
        </Group>

        {/* 5 — The words themselves. */}
        <Group title="Type" hint="The typeface, size and color of every word on your page.">
          <FontRow value={fontId} onPick={setFontId} />
          <TextSizeRow value={scale} onPick={setScale} family={getFont(fontId).family} />
          <SwatchRow
            label="Text color"
            swatches={TEXT_COLORS}
            value={ink}
            onPick={setInk}
            custom
            warn={
              isLight(ink) === isLight(backdropBase)
                ? "This is about as bright as your backdrop — your words will be hard to read on it."
                : ""
            }
          />
        </Group>

        {/* 6 — Branding that lives outside the page itself.
            Shown with a mock browser tab so the 16px reality is obvious — a
            detailed logo that looks fine here will be a smudge there. */}
        <Group title="Browser tab icon" hint="The little icon in the browser tab when someone opens your page.">
          <div>
            <p className="text-xs text-mist/70">
              Square works best — simple shapes read better than a full logo at this size.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-t-lg border border-edge border-b-0 bg-panel2 px-3 py-1.5">
                {icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={icon} alt="" className="h-4 w-4 rounded-sm object-cover" />
                ) : (
                  <span className="h-4 w-4 rounded-sm bg-brand/30" aria-hidden />
                )}
                <span className="max-w-32 truncate text-xs text-mist">Your page</span>
                <CloseIcon className="text-xs text-mist/50" />
              </span>
              <label className="btn-ghost cursor-pointer !py-2 text-sm">
                {icon ? "Replace" : "Upload icon"}
                <input
                  ref={iconFileRef}
                  type="file"
                  name="faviconFile"
                  accept="image/png,image/svg+xml,image/webp,image/x-icon,.ico,.svg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setIcon(URL.createObjectURL(f));
                    setClearIcon(false);
                  }}
                />
              </label>
              {icon && (
                <button
                  type="button"
                  onClick={() => {
                    setIcon("");
                    setClearIcon(true);
                    if (iconFileRef.current) iconFileRef.current.value = "";
                  }}
                  className="btn-ghost !py-2 text-sm !text-brand2"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-mist/60">PNG, SVG, ICO or WebP · up to 512KB</p>
          </div>
        </Group>
      </div>

      {/* Preview and the save button follow you down the page. */}
      <aside className="lg:sticky lg:top-6">
        <div className="card !p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold">Live preview</h3>
            {/* Only worth showing when there are two palettes to switch between. */}
            {colorMode === "auto" && (
              <div className="flex overflow-hidden rounded-lg border border-edge text-[11px] font-semibold">
                {(["dark", "light"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPreviewMode(m)}
                    className={`px-2 py-1 capitalize transition ${
                      previewMode === m ? "bg-brand/20 text-snow" : "text-mist hover:text-snow"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={rollAll}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-mist hover:text-snow"
            >
              <ShuffleIcon /> Randomize
            </button>
          </div>
          {/* The preview carries the creator's type as well as their colors —
              font, scale and ink all apply here exactly as they do on the
              page, so the sizes are read rather than imagined. */}
          {/* Tall enough to be a page rather than a swatch: hero, several
              sections in the chosen arrangement, a button and the footer. It
              scrolls, so a big text size shows as a longer page — which is
              exactly what it does in real life. */}
          <div className="mt-3 overflow-hidden rounded-xl border border-edge">
            <div
              className="max-h-[34rem] min-h-[30rem] overflow-y-auto p-6"
              style={{
                ...previewStyle,
                fontFamily: getFont(fontId).family,
                fontSize: `calc(0.85rem * ${scale})`,
                color: previewInk,
              }}
            >
              <p className="text-center text-[1.6em] font-extrabold leading-tight">Your name here</p>
              <p className="mx-auto mt-1.5 max-w-[22em] text-center text-[0.8em] opacity-70">
                This is how your page will feel — your type, your colors, your layout.
              </p>
              <div className="mt-4 text-center">
                <span
                  className="inline-block rounded-lg px-4 py-1.5 text-[0.85em] font-semibold text-white"
                  style={{ background: accent }}
                >
                  Your button
                </span>
              </div>

              <PreviewSections
                layout={layout}
                cardStyle={previewCardStyle}
                width={previewCardWidth}
              />

              <p className="mt-6 border-t pt-3 text-center text-[0.7em] opacity-50" style={{ borderColor: "currentColor" }}>
                Your tagline goes here
              </p>
            </div>
          </div>
          {(size !== DEFAULT_SIZE || border !== DEFAULT_BORDER) && (
            <button
              type="button"
              onClick={() => {
                setSize(DEFAULT_SIZE);
                setBorder(DEFAULT_BORDER);
              }}
              className="mt-3 text-xs text-mist/70 underline underline-offset-2 hover:text-snow"
            >
              Reset container width &amp; border
            </button>
          )}

          {/* Save sits under the preview it commits — the button is the last
              thing in the column, so "what you see" and "make it live" read as
              one action. */}
          <div className="mt-4 border-t border-edge pt-4">
            {state.error && (
              <p className="mb-3 rounded-xl border border-brand2/40 bg-brand2/10 px-3 py-2 text-xs text-brand2">
                {state.error}
              </p>
            )}
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={pending}>
                {pending ? "Saving…" : "Save theme"}
              </button>
              {/* An <a>, not a button: anything else inside this form would
                  submit it. Opens in a new tab so the builder — and any
                  unsaved edits in it — survives the trip. */}
              <a
                href={`/${slug}?preview=1`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost shrink-0"
                title="Open your real page in a new tab"
              >
                Open page ↗
              </a>
            </div>
            <p className="mt-2 text-center text-xs text-mist/70">
              {state.ok ? (
                <span className="font-semibold text-good">Saved — it&apos;s live on your page.</span>
              ) : (
                // The preview above is live; the page itself is whatever was
                // last saved. Worth saying, since the two can disagree.
                "Publishes to your live page — open it to see the saved version."
              )}
            </p>
          </div>
        </div>
      </aside>
      </form>

      {/* Two sibling forms the Saved looks controls post to. They live outside
          the design form because HTML has no nested forms — the controls stay
          up in the group and are associated by id. */}
      <form id="look-save" action={lookAction} className="hidden" />
      <form id="look-delete" action={deleteLookAction} className="hidden" />
    </>
  );
}
