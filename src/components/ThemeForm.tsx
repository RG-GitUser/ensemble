"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteLookAction, saveLookAction, updateTheme, type FormState } from "@/lib/actions";
import type { SavedLook } from "@/lib/types";
import {
  ACCENTS,
  BACKGROUNDS,
  BORDER_STYLES,
  borderCss,
  BUTTON_STYLES,
  BUTTON_HOVERS,
  CONTAINER_HOVERS,
  buttonVars,
  DEFAULT_GLOW,
  getGlow,
  GLOWS,
  GLOW_SIZES,
  DEFAULT_GLOW_SIZE,
  getGlowSize,
  clampMinHeight,
  clampSize,
  MIN_HEIGHT_MAX,
  SIZE_MAX,
  SIZE_MIN,
  CONTAINERS,
  COLOR_MODES,
  type ColorMode,
  CORNERS,
  DEFAULT_BORDER,
  DEFAULT_SIZE,
  edgeForLight,
  getCorner,
  getSpacing,
  isLight,
  FRAMES,
  LAYOUTS,
  type ScaleDef,
  SPACINGS,
  LIGHT_BACKGROUNDS,
  LIGHT_CONTAINERS,
  MAX_LOOKS,
  normalizeHex,
  type Swatch,
} from "@/lib/theme";
import { backdropCss, BRIGHT_GROUP, DARK_THEME_GROUPS, DARK_THEMES, getThemeDef, LIGHT_THEMES, themeCss, type ThemeGroup } from "@/lib/themes";
import { FONTS, getFont, LIGHT_TEXT_COLORS, TEXT_COLORS, TEXT_SIZES } from "@/lib/fonts";
import { CloseIcon, ShuffleIcon } from "@/components/icons";

/**
 * The Design tab's panes, in the order a page is built up — the backdrop
 * behind everything, then the containers on it, then the accent tying them
 * together, then type and branding. Saved looks is a utility, so it sits last.
 */
const PANES = [
  { id: "backdrop", name: "Backdrop" },
  { id: "containers", name: "Containers" },
  { id: "accent", name: "Accent" },
  { id: "layout", name: "Layout" },
  { id: "font", name: "Font" },
  { id: "icon", name: "Tab icon" },
  { id: "looks", name: "Saved looks" },
] as const;

type PaneId = (typeof PANES)[number]["id"];

/**
 * One titled block of related controls — one pane of the Design tab.
 *
 * An inactive pane is hidden, not unmounted: several groups hold file inputs
 * and hidden fields, and unmounting them would quietly drop those values from
 * the next save.
 */
function Group({
  title,
  hint,
  pane,
  active,
  children,
}: {
  title: string;
  hint?: string;
  pane: PaneId;
  active: PaneId;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`pane-${pane}`}
      role="tabpanel"
      aria-labelledby={`tab-${pane}`}
      className={`card !p-5${pane === active ? "" : " hidden"}`}
    >
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
        selected ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
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
                selected ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
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
                selected ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
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
      <div className="grid gap-2 sm:grid-cols-2">
        {LAYOUTS.map((l) => {
          const selected = value === l.id;
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(l.id)}
              className={`rounded-xl border p-3 text-left transition ${
                selected ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
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
                {l.id === "focus" && (
                  <>
                    <span className={`${bar} h-2.5 w-full`} />
                    <span className={`${bar} mx-auto h-2.5 w-1/2`} />
                    <span className={`${bar} mx-auto h-2.5 w-1/2`} />
                  </>
                )}
                {l.id === "storefront" && (
                  <span className="flex h-full items-center gap-1.5">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-mist/35" />
                    <span className="flex flex-1 flex-col gap-1.5">
                      <span className="flex gap-1.5">
                        <span className={`${bar} h-2.5 w-1/2`} />
                        <span className={`${bar} h-2.5 w-1/2`} />
                      </span>
                      <span className="flex gap-1.5">
                        <span className={`${bar} h-2.5 w-1/2`} />
                        <span className={`${bar} h-2.5 w-1/2`} />
                      </span>
                    </span>
                  </span>
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
 * Spacing and corner pickers share one tile row: a label, a blurb and a
 * little drawing of what the page does — bars drifting apart for rhythm, a
 * card whose corner actually wears the radius for roundness.
 */
function ScaleRow({
  label,
  hint,
  options,
  value,
  onPick,
  kind,
}: {
  label: string;
  hint: string;
  options: ScaleDef[];
  value: string;
  onPick: (v: string) => void;
  kind: "spacing" | "corner";
}) {
  const bar = "rounded-[3px] bg-mist/35";
  return (
    <div>
      <span className="label !mb-0">{label}</span>
      <p className="mt-0.5 text-xs text-mist/70">{hint}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {options.map((o) => {
          const selected = value === o.id;
          const mult = Number(o.value);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(o.id)}
              className={`rounded-xl border p-3 text-left transition ${
                selected ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
              }`}
            >
              <span className="flex h-14 flex-col items-center justify-center rounded-lg bg-panel2 p-2">
                {kind === "spacing" ? (
                  <span className="flex w-full flex-col" style={{ gap: `${2 + mult * 5}px` }}>
                    <span className={`${bar} h-2 w-full`} />
                    <span className={`${bar} h-2 w-full`} />
                    <span className={`${bar} h-2 w-full`} />
                  </span>
                ) : (
                  <span
                    className="h-9 w-4/5 border-2 border-mist/50 bg-mist/15"
                    style={{ borderRadius: `${mult * 9}px` }}
                  />
                )}
              </span>
              <span className="mt-2 block text-xs font-semibold">{o.label}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-mist">{o.blurb}</span>
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
  minHeight,
  rhythm,
}: {
  layout: string;
  cardStyle: React.CSSProperties;
  /** Container width setting, as a percentage of the widest option. */
  width: string;
  /** Container min-height in rem (0 = content decides), drawn to preview scale. */
  minHeight: number;
  /** Section-spacing multiplier — the preview's gaps drift with it. */
  rhythm: number;
}) {
  // The real floor is 0–24rem against ~48rem-wide sections; a third of it
  // keeps the same feel at preview scale without swallowing the panel.
  const floor = minHeight > 0 ? `${(minHeight * 0.32).toFixed(2)}rem` : undefined;
  const gap = `${(0.75 * rhythm).toFixed(3)}rem`;
  const column: React.CSSProperties = { display: "flex", flexDirection: "column", gap, width: "100%", marginInline: "auto" };
  // Each card takes the width its real section would. `width` arrives as the
  // site-w-lg proportion, so the others are scaled off it rather than
  // recomputed — one source for the setting, four honest widths.
  const lg = Number.parseFloat(width) || 100;
  const at = (baseRem: number) => ({ width: `${Math.min(100, (lg * baseRem) / 48).toFixed(1)}%`, marginInline: "auto" });

  const Card = ({ title, sub, style }: { title: string; sub: string; style?: React.CSSProperties }) => (
    <div className="rounded-xl p-3" style={{ minHeight: floor, ...cardStyle, ...style }}>
      <p className="text-[0.85em] font-semibold leading-snug">{title}</p>
      {sub && <p className="mt-0.5 text-[0.72em] leading-snug opacity-70">{sub}</p>}
    </div>
  );

  if (layout === "side") {
    return (
      <div className="mt-5" style={column}>
        <div className="grid grid-cols-2" style={{ gap }}>
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
      <div className="mt-5" style={column}>
        <Card title="Featured video" sub="Your latest" style={{ width: "80%" }} />
        <Card title="About me" sub="Your story" style={{ width: "80%", marginLeft: "20%" }} />
        <Card title="Bonus content" sub="Early access" style={{ width: "80%" }} />
        <Card title="Links" sub="Everywhere else" style={{ width: "80%", marginLeft: "20%" }} />
        <Card title="Footer" sub="Full width — it closes the page" />
      </div>
    );
  }

  if (layout === "focus") {
    // 30rem column against the 48rem base — the same ratio the page uses.
    return (
      <div className="mt-5" style={column}>
        <Card title="Featured video" sub="Your latest" style={at(30)} />
        <Card title="Bonus content" sub="Early access" style={at(30)} />
        <Card title="Links" sub="Find me everywhere" style={at(28)} />
        <Card title="Footer" sub="Full width — it closes the page" />
      </div>
    );
  }

  if (layout === "storefront") {
    // The panel is drawn, not composed from the real one: at preview scale a
    // portrait and three lines of type would be unreadable, so this is the
    // shape of it rather than the thing itself.
    // Storefront runs on a wider measure than the other layouts (72rem against
    // site-w-lg's 48rem), so the preview takes the full column here. Drawing it
    // at the narrow measure made it read as inset and off-centre against the
    // hero above, which is the opposite of what the layout actually does.
    return (
      <div className="mt-5" style={{ ...column, width: "100%" }}>
        <div className="grid items-start" style={{ gap, gridTemplateColumns: "31% 1fr" }}>
          <div className="flex flex-col items-center gap-1 py-1">
            <div className="h-11 w-11 rounded-full" style={{ background: "currentColor", opacity: 0.32 }} />
            <p className="whitespace-nowrap text-[0.78em] font-bold leading-tight">Your name</p>
            <p className="whitespace-nowrap text-[0.66em] leading-tight opacity-60">@handle</p>
            <div className="mt-0.5 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full"
                  style={{ background: "currentColor", opacity: 0.32 }}
                />
              ))}
            </div>
          </div>
          {/* Titles only. At this width a second line wraps on every card and
              the grid stops reading as a grid, which is the whole point. */}
          <div className="grid grid-cols-2" style={{ gap }}>
            <Card title="Bonus" sub="" />
            <Card title="Merch" sub="" />
            <Card title="About" sub="" />
            <Card title="Links" sub="" />
          </div>
        </div>
        <Card title="Footer" sub="Full width, it closes the page" />
      </div>
    );
  }

  // Each card at the width its real section uses: merch is the widest at
  // 56rem, a link list the narrowest at 28rem, most sit at 48rem. Drawing them
  // all identically was what made the sizer read as inaccurate.
  return (
    <div className="mt-5" style={column}>
      <Card title="Featured video" sub="Your latest" style={at(48)} />
      <Card title="Bonus content" sub="Drops, behind the scenes, early access" style={at(48)} />
      <Card title="Merch" sub="Sell straight from the page" style={at(56)} />
      <Card title="Links" sub="Find me everywhere" style={at(28)} />
    </div>
  );
}

/** Width picker — each tile draws its option to scale, widest option full. */
/**
 * Container size: pull the sample's edges and they follow your cursor.
 *
 * Five named widths were a guess at which ones anyone would want. The value
 * underneath was always a plain multiplier, so setting it freely needed no new
 * storage, only a control that lets you land between the old steps.
 *
 * The sample grows from its centre horizontally because that is what a real
 * section does: page containers are centred, so an edge dragged right moves
 * the opposite edge left by the same amount.
 *
 * Height is a floor rather than a fixed size. Sections hold wildly different
 * amounts, and one exact height would clip a merch grid or strand a links list
 * in whitespace, so a taller section still grows past whatever is set here.
 */
/** The retired named widths, kept as one-tap starting points beside the drag. */
const WIDTH_PRESETS = [
  { label: "Narrow", value: 0.8 },
  { label: "Standard", value: 1 },
  { label: "Wide", value: 1.3 },
  { label: "Extra wide", value: 1.6 },
];

function SizeRow({
  width,
  onWidth,
  minHeight,
  onMinHeight,
}: {
  width: string;
  onWidth: (v: string) => void;
  minHeight: string;
  onMinHeight: (v: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Where the pointer went down and what the values were then. A drag moves
  // the edge relative to that grab, so picking up a handle never makes the
  // value jump to wherever the cursor happened to land on it.
  const grab = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const w = Number(clampSize(width));
  const h = Number(clampMinHeight(minHeight));
  const span = SIZE_MAX - SIZE_MIN;
  const widthPct = ((w - SIZE_MIN) / span) * 100;
  // The sample is scaled to sit in a control, not to be a ruler. The number
  // beside it is the honest value; this only has to move the right way.
  const boxPx = 44 + (h / MIN_HEIGHT_MAX) * 150;

  function dragWidth(clientX: number, side: -1 | 1) {
    const parent = boxRef.current?.parentElement;
    if (!parent || !grab.current) return;
    const pw = parent.getBoundingClientRect().width;
    if (pw === 0) return;
    // The box is centred, so an edge pulled outward widens it from both
    // sides at once — one pointer step moves the width by two.
    const dw = (((clientX - grab.current.x) * side * 2) / pw) * span;
    onWidth(clampSize(grab.current.w + dw));
  }

  function dragHeight(clientY: number) {
    if (!grab.current) return;
    onMinHeight(clampMinHeight(grab.current.h + ((clientY - grab.current.y) / 150) * MIN_HEIGHT_MAX));
  }

  const handle =
    "absolute flex touch-none items-center justify-center rounded-md border border-brand bg-panel transition hover:bg-brand/20";

  return (
    <div>
      <span className="label !mb-0">Container size</span>
      <p className="mt-0.5 text-xs text-mist/70">
        Drag the side edges to set how wide your sections run, and the bottom edge to give them a minimum height — the
        live preview follows as you drag. Double-click an edge to reset it. Every section scales together, so a links
        list stays narrower than a merch grid.
      </p>

      <div className="mt-3 select-none rounded-xl border border-edge bg-panel2 px-3 py-4">
        <div
          ref={boxRef}
          className="relative mx-auto rounded-lg bg-mist/20 shadow-[inset_0_0_0_1px_var(--hairline)]"
          style={{ width: `${Math.max(widthPct, 6)}%`, height: `${boxPx}px` }}
        >
          {/* Either side edge says the same thing, and reaching for the nearer
              one is what anyone does. */}
          {([-1, 1] as const).map((side) => (
            <button
              key={side}
              type="button"
              role="slider"
              aria-label={`Container width, ${side === -1 ? "left" : "right"} edge`}
              aria-valuemin={SIZE_MIN}
              aria-valuemax={SIZE_MAX}
              aria-valuenow={w}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                grab.current = { x: e.clientX, y: e.clientY, w, h };
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) dragWidth(e.clientX, side);
              }}
              onDoubleClick={() => onWidth(DEFAULT_SIZE)}
              title="Drag to resize — double-click for standard width"
              onKeyDown={(e) => {
                const by = e.key === "ArrowRight" || e.key === "ArrowUp" ? 0.02 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -0.02 : 0;
                if (by) { e.preventDefault(); onWidth(clampSize(w + by)); }
              }}
              className={`${handle} top-1/2 h-10 w-4 -translate-y-1/2 cursor-ew-resize ${side === -1 ? "-left-2" : "-right-2"}`}
            >
              <span aria-hidden className="h-4 w-[2px] rounded-full bg-brand" />
            </button>
          ))}

          <button
            type="button"
            role="slider"
            aria-label="Container minimum height"
            aria-valuemin={0}
            aria-valuemax={MIN_HEIGHT_MAX}
            aria-valuenow={h}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              grab.current = { x: e.clientX, y: e.clientY, w, h };
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) dragHeight(e.clientY);
            }}
            onDoubleClick={() => onMinHeight("0")}
            title="Drag for a height floor — double-click to let content decide"
            onKeyDown={(e) => {
              const by = e.key === "ArrowDown" ? 0.5 : e.key === "ArrowUp" ? -0.5 : 0;
              if (by) { e.preventDefault(); onMinHeight(clampMinHeight(h + by)); }
            }}
            className={`${handle} -bottom-2 left-1/2 h-4 w-10 -translate-x-1/2 cursor-ns-resize`}
          >
            <span aria-hidden className="h-[2px] w-4 rounded-full bg-brand" />
          </button>
        </div>
      </div>

      {/* The old named widths, back as one-tap shortcuts under the free drag. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {WIDTH_PRESETS.map((p) => {
          const active = Math.abs(w - p.value) < 0.005;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onWidth(clampSize(p.value))}
              aria-pressed={active}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                active ? "border-brand bg-brand/15 text-snow" : "border-edge text-mist hover:border-brand/60 hover:text-snow"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="text-mist/70">
          {h === 0 ? (
            "Height follows your content"
          ) : (
            <>
              At least {h}rem tall, and taller when the content needs it —{" "}
              <button type="button" onClick={() => onMinHeight("0")} className="underline underline-offset-2 hover:text-snow">
                clear
              </button>
            </>
          )}
        </span>
        <span className="font-mono text-snow">
          {w.toFixed(2)}&times; wide{h > 0 ? ` · ${h}rem min` : ""}
        </span>
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
                selected ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
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
 * branding. Each group is a tab rather than another card in a stack — the whole
 * tab used to be one long scroll, and reaching Type meant travelling past every
 * decision before it. The preview and the save button ride along in a sticky
 * column, so whichever pane you're editing you can see the result and commit it.
 */
export function ThemeForm({
  themeColor,
  bgColor,
  cardColor,
  containerSize,
  containerMinHeight,
  borderStyle,
  bgImage,
  cardImage,
  faviconUrl,
  gradient: gradientProp,
  glowStrength: glowStrengthProp,
  glowSize: glowSizeProp,
  glowColor: glowColorProp,
  buttonStyle: buttonStyleProp,
  containerHover: containerHoverProp,
  buttonHover: buttonHoverProp,
  themeId: themeIdProp,
  fontId: fontIdProp,
  fontScale: fontScaleProp,
  textColor: textColorProp,
  layout: layoutProp,
  profileImage,
  profileFrame: profileFrameProp,
  profileHandle: profileHandleProp,
  profileLocation: profileLocationProp,
  sectionSpacing: spacingProp,
  cornerStyle: cornerProp,
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
  /** Container width multiplier, anywhere between SIZE_MIN and SIZE_MAX. */
  containerSize: string;
  /** Floor under every container, in rem ("0" = none). */
  containerMinHeight: string;
  /** Container border treatment (BORDER_STYLES id). */
  borderStyle: string;
  bgImage: string;
  cardImage: string;
  /** Current browser tab icon for the public page ("" = Ensemble default). */
  faviconUrl: string;
  gradient: boolean;
  /** Accent wash strength (GLOWS id) and button treatment (BUTTON_STYLES id). */
  glowStrength: string;
  /** How far the wash spreads (GLOW_SIZES id). */
  glowSize: string;
  /** Wash colour, or "" to follow the accent. */
  glowColor: string;
  buttonStyle: string;
  /** Hover treatments (CONTAINER_HOVERS / BUTTON_HOVERS ids). */
  containerHover: string;
  buttonHover: string;
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
  /** Storefront profile panel. All optional; the panel copes without them. */
  profileImage: string;
  profileFrame: string;
  profileHandle: string;
  profileLocation: string;
  /** Vertical air between sections (SPACINGS id). */
  sectionSpacing: string;
  /** Corner roundness of containers and buttons (CORNERS id). */
  cornerStyle: string;
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
  const [minH, setMinH] = useState(containerMinHeight);
  const [border, setBorder] = useState(borderStyle);
  const [gradient, setGradient] = useState(gradientProp);
  const [glowStrength, setGlowStrength] = useState(glowStrengthProp);
  const [glowSize, setGlowSize] = useState(glowSizeProp);
  const [glowColor, setGlowColor] = useState(glowColorProp);
  const [buttonStyle, setButtonStyle] = useState(buttonStyleProp);
  const [containerHover, setContainerHover] = useState(containerHoverProp);
  const [buttonHover, setButtonHover] = useState(buttonHoverProp);
  const [themeId, setThemeId] = useState(themeIdProp);
  const [fontId, setFontId] = useState(fontIdProp);
  const [scale, setScale] = useState(fontScaleProp);
  const [ink, setInk] = useState(textColorProp);
  const [layout, setLayout] = useState(layoutProp);
  const [profileImg, setProfileImg] = useState<string>(profileImage);
  const [clearProfile, setClearProfile] = useState(false);
  const [frame, setFrame] = useState(profileFrameProp);
  const [handle, setHandle] = useState(profileHandleProp);
  const [where, setWhere] = useState(profileLocationProp);
  const [spacing, setSpacing] = useState(spacingProp);
  const [corner, setCorner] = useState(cornerProp);
  const [colorMode, setColorMode] = useState<ColorMode>(colorModeProp);
  const [lightBg, setLightBg] = useState(lightBgColor);
  const [lightCard, setLightCard] = useState(lightCardColor);
  const [lightInk, setLightInk] = useState(lightTextColor);
  const [lightThemeId, setLightThemeId] = useState(lightThemeIdProp);
  /** Which palette the preview is showing — editing aid only, never saved. */
  /** Which group of controls is on screen. Backdrop is where designing starts. */
  const [pane, setPane] = useState<PaneId>("backdrop");
  // Which palette the colour controls are pointing at. With one look chosen
  // there is nothing to switch and the mode decides; with both, the tab at the
  // top of Backdrop does. The preview follows it, so you are always looking at
  // the thing you are editing.
  const [editTab, setEditTab] = useState<"dark" | "light">(colorModeProp === "light" ? "light" : "dark");
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
  const profileFileRef = useRef<HTMLInputElement>(null);
  const cardFileRef = useRef<HTMLInputElement>(null);
  const iconFileRef = useRef<HTMLInputElement>(null);

  // After a successful save the generated SVG is stored server-side — drop the
  // pending copy so re-saving doesn't write a duplicate file.
  useEffect(() => {
    if (state.ok) setBgSvg("");
  }, [state]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>, which: "bg" | "card" | "profile") {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    if (which === "profile") {
      setProfileImg(url);
      setClearProfile(false);
    } else if (which === "bg") {
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
    palette.setThemeId(randomOf([...palette.presets, { id: "" }]).id);
    palette.setBg(randomOf(palette.backgrounds).value);
    palette.setCard(randomOf(palette.containers).value);
    setSize(clampSize(SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN)));
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
    palette.setBg(color);
    setGradient(false);
    setBgImg("");
    setBgSvg("");
    setClearBg(true);
    // The preset stays put. It no longer owns the backdrop, so the typed color
    // takes effect underneath it — and dropping someone's preset because they
    // reached for the color picker would be the surprising move now.
    if (bgFileRef.current) bgFileRef.current.value = "";
  }

  function removeImage(which: "bg" | "card" | "profile") {
    if (which === "profile") {
      setProfileImg("");
      setClearProfile(true);
      if (profileFileRef.current) profileFileRef.current.value = "";
      return;
    }
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
  const editing: "dark" | "light" = colorMode === "auto" ? editTab : colorMode;
  const lit = editing === "light";
  /**
   * Every colour control reads its list, its value and its setter from here,
   * so adding a palette-aware control is one entry rather than a conditional
   * threaded through the JSX.
   */
  const palette = lit
    ? {
        presets: LIGHT_THEMES,
        groups: [BRIGHT_GROUP] as ThemeGroup[],
        themeId: lightThemeId,
        setThemeId: setLightThemeId,
        backgrounds: LIGHT_BACKGROUNDS,
        bg: lightBg,
        setBg: setLightBg,
        containers: LIGHT_CONTAINERS,
        card: lightCard,
        setCard: setLightCard,
        inks: LIGHT_TEXT_COLORS,
        ink: lightInk,
        setInk: setLightInk,
      }
    : {
        presets: DARK_THEMES,
        groups: DARK_THEME_GROUPS,
        themeId,
        setThemeId,
        backgrounds: BACKGROUNDS,
        bg,
        setBg,
        containers: CONTAINERS,
        card,
        setCard,
        inks: TEXT_COLORS,
        ink,
        setInk,
      };
  // The three glow values every surface here draws with. They sit above the
  // preview because the preview is the first thing that reads them, and each
  // one used to be hardcoded somewhere below: the wash was a fixed 55, the
  // geometry a fixed "62% 44%", and the tint always the accent. That is what
  // made the glow controls look inert — they saved correctly and the preview
  // simply ignored them.
  const glowAlpha = getGlow(glowStrength)?.alpha ?? getGlow(DEFAULT_GLOW)!.alpha;
  const glowGeom = getGlowSize(glowSize) ?? getGlowSize(DEFAULT_GLOW_SIZE)!;
  /** Blank means "follow the accent", so every draw site resolves it the same way. */
  const glowTint = glowColor || accent;
  const previewButton = buttonVars(buttonStyle, accent);
  /** Mirrors .site-frame-* from globals.css, scaled to the preview portrait. */
  const previewFrameStyle: React.CSSProperties =
    frame === "ring"
      ? { padding: 3, background: accent }
      : frame === "gradient"
        ? { padding: 3, background: `linear-gradient(145deg, ${accent}, transparent 85%)` }
        : frame === "glow"
          ? { boxShadow: `0 0 0 1px ${accent}59, 0 10px 28px ${accent}4d` }
          : {};
  const previewStyle = backdropCss({
    themeId: palette.themeId,
    accent,
    bgColor: palette.bg,
    bgImage: bgImg,
    glow: gradient,
    glowSize: glowGeom.preview,
    glowAlpha,
    glowColor: glowTint,
  });
  /** Everything the Design tab owns, exactly as it stands right now. */
  const currentDesign = {
    themeColor: accent,
    bgColor: bg,
    cardColor: card,
    containerSize: size,
    containerMinHeight: minH,
    borderStyle: border,
    bgImage: bgImg,
    cardImage: cardImg,
    gradient,
    themeId,
    fontId,
    fontScale: scale,
    textColor: ink,
    layout,
    sectionSpacing: spacing,
    cornerStyle: corner,
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
    if (d.containerMinHeight !== undefined) setMinH(d.containerMinHeight);
    if (d.borderStyle) setBorder(d.borderStyle);
    if (d.fontId !== undefined) setFontId(d.fontId);
    if (d.fontScale) setScale(d.fontScale);
    if (d.textColor) setInk(d.textColor);
    if (d.layout) setLayout(d.layout);
    if (d.sectionSpacing) setSpacing(d.sectionSpacing);
    if (d.cornerStyle) setCorner(d.cornerStyle);
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

  const previewInk = palette.ink;
  const previewCardStyle = {
    background: `${cardImg ? `url("${cardImg}") center / cover no-repeat, ` : ""}${palette.card}`,
    // The preview cards' natural radius is 0.75rem — scaled by the corner
    // setting exactly as .site-round-xl scales the page's own.
    borderRadius: `${0.75 * Number(getCorner(corner)?.value ?? 1)}rem`,
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
    backgroundImage: `${gradient ? `radial-gradient(${glowGeom.preview} at 50% -10%, ${glowTint}${glowAlpha}, transparent 70%), ` : ""}${
      bgImg ? `url("${bgImg}") center / cover no-repeat` : "none"
    }`,
    backgroundColor: palette.bg,
  };
  /** The preview card apes the chosen width against the widest option. */
  /**
   * The preview modelled the width setting as a straight fraction of the
   * widest option, which drew every container the same and claimed full width
   * for all of them at the top of the range. The page does neither: a section
   * is `min(100%, base * size)` against its own base width, and the bases
   * differ — 28rem for a link list, 56rem for a merch grid. Measured against a
   * 1265px viewport at size 1.6 the real widths are 57%, 85%, 97% and 100%.
   *
   * So the preview now models the same thing, against an 80rem reference
   * viewport, which reproduces those four numbers to within a point.
   */
  const previewWidthFor = (baseRem: number) =>
    `${Math.min(100, (baseRem * Number(clampSize(size))) / 80 * 100).toFixed(1)}%`;
  const previewCardWidth = previewWidthFor(48);
  /** What the text actually sits on, so the ink can be checked against it. */
  const backdropBase = (palette.themeId ? getThemeDef(palette.themeId)?.color : palette.bg) || palette.bg;

  return (
    <>
      <form action={formAction} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <input type="hidden" name="themeColor" value={accent} />
      <input type="hidden" name="bgColor" value={bg} />
      <input type="hidden" name="cardColor" value={card} />
      <input type="hidden" name="containerSize" value={size} />
      <input type="hidden" name="containerMinHeight" value={minH} />
      <input type="hidden" name="borderStyle" value={border} />
      <input type="hidden" name="themeId" value={themeId} />
      <input type="hidden" name="fontId" value={fontId} />
      <input type="hidden" name="fontScale" value={scale} />
      <input type="hidden" name="textColor" value={ink} />
      <input type="hidden" name="layout" value={layout} />
      <input type="hidden" name="sectionSpacing" value={spacing} />
      <input type="hidden" name="cornerStyle" value={corner} />
      <input type="hidden" name="colorMode" value={colorMode} />
      <input type="hidden" name="lightBgColor" value={lightBg} />
      <input type="hidden" name="lightCardColor" value={lightCard} />
      <input type="hidden" name="lightTextColor" value={lightInk} />
      <input type="hidden" name="lightThemeId" value={lightThemeId} />
      <input type="hidden" name="bgSvg" value={bgSvg} />
      <input type="hidden" name="clearBgImage" value={clearBg ? "1" : ""} />
      <input type="hidden" name="clearProfileImage" value={clearProfile ? "1" : ""} />
      <input type="hidden" name="clearCardImage" value={clearCard ? "1" : ""} />
      <input type="hidden" name="clearFavicon" value={clearIcon ? "1" : ""} />

      {/* Sub-tabs for the Design tab, sitting under the Sections/Design bar.
          `type="button"` matters — a bare button in here would submit the form
          and save the page on every pane change. */}
      <div className="flex gap-1 overflow-x-auto border-b border-edge lg:col-span-2" role="tablist">
        {PANES.map((p) => {
          const active = pane === p.id;
          return (
            <button
              key={p.id}
              id={`tab-${p.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`pane-${p.id}`}
              onClick={() => setPane(p.id)}
              className={`-mb-px shrink-0 border-b-2 px-3.5 py-2 text-sm font-semibold transition ${
                active ? "border-brand text-snow" : "border-transparent text-mist hover:text-snow"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* No vertical rhythm to keep: exactly one pane is ever visible, and a
          space-y here would indent it by however many hidden panes precede it. */}
      <div>
        {/* 0 — Looks you've already built. Its controls belong to the sibling
            form below, wired up by id so they can sit here without nesting. */}
        <Group
          pane="looks" active={pane}
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
        <Group pane="backdrop" active={pane} title="Backdrop" hint="The canvas your whole page sits on. Start from a preset or build your own.">
          <div>
            <span className="label !mb-0">Your look</span>
            <p className="mt-0.5 text-xs text-mist/70">
              Design the one your own brand already is. Pick <span className="text-snow">Both</span> and you design a
              second palette as well, and visitors get whichever suits them.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {COLOR_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setColorMode(m.id)}
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

          {/* Only meaningful with two palettes. With one there is nothing to
              switch between, and the mode already says which it is. */}
          {colorMode === "auto" && (
            <div>
              <span className="label !mb-0">Editing</span>
              <p className="mt-0.5 text-xs text-mist/70">
                Every color on this tab — backdrop, containers and text — belongs to the palette you pick here. Your
                accent, type, layout and container shape are shared by both.
              </p>
              <div className="mt-2 flex overflow-hidden rounded-xl border border-edge">
                {(["dark", "light"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEditTab(m)}
                    className={`flex-1 px-3 py-2 text-sm font-semibold capitalize transition ${
                      editing === m ? "bg-brand/20 text-snow" : "text-mist hover:text-snow"
                    }`}
                  >
                    {m} look
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="label !mb-0">Preset</span>
            <p className="mt-0.5 text-xs text-mist/70">
              A complete backdrop look — {palette.presets.length} of them, all {lit ? "pale enough for dark" : "dark enough for pale"}{" "}
              text. Pick <span className="text-snow">My colors</span> to design your own with the controls below.
            </p>
            {/* Grouped by what the look is made of, so twenty tiles stay
                scannable: light and color, then textures, then patterns. */}
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {/* Named for what it does, not for what it isn't: this is the
                  tile that hands the backdrop back to the controls below. */}
              <PresetTile
                name="My colors"
                selected={palette.themeId === ""}
                onPick={() => palette.setThemeId("")}
                style={customTileStyle}
              />
            </div>
            {palette.groups.map((g) => (
              <div key={g} className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-mist/60">{g}</p>
                <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {palette.presets.filter((t) => t.group === g).map((t) => (
                    <PresetTile
                      key={t.id}
                      name={t.name}
                      selected={palette.themeId === t.id}
                      onPick={() => palette.setThemeId(t.id)}
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
                Starting from <span className="font-semibold text-snow">{getThemeDef(themeId)?.name}</span>
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
              swatches={palette.backgrounds}
              value={palette.bg}
              onPick={palette.setBg}
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

        </Group>

        {/* 2 — The boxes your content lives in. */}
        <Group pane="containers" active={pane} title="Containers" hint="The cards and panels each section sits in — their tint, width and edges.">
          <SwatchRow
            label="Container color"
            hint="Shown over your backdrop, so the translucent tints pick up whatever is behind them. A pasted hex is solid — it covers the backdrop rather than tinting it."
            swatches={palette.containers}
            value={palette.card}
            onPick={palette.setCard}
            base={palette.bg}
            custom
          />
          <SizeRow width={size} onWidth={setSize} minHeight={minH} onMinHeight={setMinH} />
          <ScaleRow
            label="Corners"
            hint="One setting rounds every container and button together, from square to pill."
            options={CORNERS}
            value={corner}
            onPick={setCorner}
            kind="corner"
          />
          <BorderRow value={border} onPick={setBorder} accent={accent} card={palette.card} base={palette.bg} />

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
        <Group pane="accent" active={pane} title="Accent" hint="Buttons, links, highlights and the accent border styles above.">
          <SwatchRow label="Accent color" swatches={ACCENTS} value={accent} onPick={setAccent} custom />
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
                    gradient === o.on ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
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
                        o.on ? `radial-gradient(70px 34px at 50% -10%, ${glowTint}${glowAlpha}, transparent 70%), ` : ""
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

          {/* Only worth choosing once there is a wash to size. */}
          {gradient && (
            <div>
              <span className="label !mb-0">Glow strength</span>
              <p className="mt-0.5 text-xs text-mist/70">How much of your accent washes over the top of the page.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {GLOWS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={glowStrength === g.id}
                    onClick={() => setGlowStrength(g.id)}
                    className={`w-[8.5rem] overflow-hidden border text-left transition ${
                      glowStrength === g.id ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
                    }`}
                  >
                    <span
                      className="block h-10 w-full"
                      style={{ background: `radial-gradient(70px 34px at 50% -10%, ${glowTint}${g.alpha}, transparent 70%), ${bg}` }}
                    />
                    <span className="block px-2 py-1.5">
                      <span className="block text-[11px] font-semibold">{g.label}</span>
                      <span className="block text-[10px] text-mist">{g.blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size and colour are only choices once there is a wash to shape.
              Both exist because several backdrop presets ship their own
              gradient artwork: against those, an accent-coloured wash at the
              stock spread just muddies what is already there, so the glow
              needs to be shrunk, restrained, or moved off the accent. */}
          {gradient && (
            <div>
              <span className="label !mb-0">Glow size</span>
              <p className="mt-0.5 text-xs text-mist/70">How far the wash spreads before it fades out.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {GLOW_SIZES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={glowSize === g.id}
                    onClick={() => setGlowSize(g.id)}
                    className={`w-[8.5rem] overflow-hidden border text-left transition ${
                      glowSize === g.id ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
                    }`}
                  >
                    {/* Each tile draws its own geometry at the same scale the
                        side preview uses, so picking one is a like-for-like
                        comparison rather than a guess from the label. */}
                    <span
                      className="block h-10 w-full"
                      style={{ background: `radial-gradient(${g.preview} at 50% -10%, ${glowTint}${glowAlpha}, transparent 70%), ${bg}` }}
                    />
                    <span className="block px-2 py-1.5">
                      <span className="block text-[11px] font-semibold">{g.label}</span>
                      <span className="block text-[10px] text-mist">{g.blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {gradient && (
            <div>
              <span className="label !mb-0">Glow color</span>
              <p className="mt-0.5 text-xs text-mist/70">
                Follows your accent unless you set it apart — useful when the backdrop already has a gradient of its own.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {/* "" is the stored value for following the accent, so this tile
                    is a real choice rather than the absence of one. */}
                <button
                  type="button"
                  aria-pressed={glowColor === ""}
                  onClick={() => setGlowColor("")}
                  className={`w-[8.5rem] overflow-hidden border text-left transition ${
                    glowColor === "" ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
                  }`}
                >
                  <span
                    className="block h-10 w-full"
                    style={{ background: `radial-gradient(70px 34px at 50% -10%, ${accent}${glowAlpha}, transparent 70%), ${bg}` }}
                  />
                  <span className="block px-2 py-1.5">
                    <span className="block text-[11px] font-semibold">Follow accent</span>
                    <span className="block text-[10px] text-mist">Matches your color</span>
                  </span>
                </button>
                {ACCENTS.map((sw) => (
                  <button
                    key={sw.value}
                    type="button"
                    aria-pressed={glowColor === sw.value}
                    onClick={() => setGlowColor(sw.value)}
                    aria-label={`Glow color: ${sw.label}`}
                    className={`h-10 w-10 rounded-full border-2 transition ${
                      glowColor === sw.value ? "border-brand" : "border-edge hover:border-brand/60"
                    }`}
                    style={{ background: sw.value }}
                  />
                ))}
              </div>
              {/* The usual "too light for white text" caution is meaningless for
                  a wash — nothing is read on top of it. */}
              <HexPicker label="Glow color" value={glowColor} onPick={setGlowColor} warning="" />
            </div>
          )}
          <input type="hidden" name="glowSize" value={glowSize} />
          <input type="hidden" name="glowColor" value={glowColor} />

          <div>
            <span className="label !mb-0">Buttons</span>
            <p className="mt-0.5 text-xs text-mist/70">
              How your accent paints every button on the page, from the hero down to the footer.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {BUTTON_STYLES.map((b) => {
                const vars = buttonVars(b.id, accent);
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={buttonStyle === b.id}
                    onClick={() => setButtonStyle(b.id)}
                    className={`flex items-center gap-3 border p-2.5 text-left transition ${
                      buttonStyle === b.id ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
                    }`}
                  >
                    <span
                      className="inline-flex h-7 shrink-0 items-center px-3 text-[11px] font-semibold"
                      style={{
                        background: vars["--site-btn-bg"],
                        color: vars["--site-btn-ink"],
                        border: `1px solid ${vars["--site-btn-border"]}`,
                        borderRadius: `${0.5 * Number(getCorner(corner)?.value ?? 1)}rem`,
                      }}
                    >
                      Button
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold">{b.label}</span>
                      <span className="block text-[10px] text-mist">{b.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <input type="hidden" name="glowStrength" value={glowStrength} />
          {/* Words rather than swatches: a hover is a behaviour, and a static
              tile can only ever hint at one. Kept as two compact rows so the
              panel doesn't grow another two grids of pictures. */}
          <div>
            <span className="label !mb-0">On hover</span>
            <p className="mt-0.5 text-xs text-mist/70">
              What containers and buttons do when someone points at them. Hover the options to try them.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-mist">
                  Containers
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {CONTAINER_HOVERS.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      aria-pressed={containerHover === h.id}
                      title={h.blurb}
                      onClick={() => setContainerHover(h.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                        containerHover === h.id ? "border-brand bg-brand/10 text-snow" : "border-edge text-mist hover:border-brand/60"
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-mist">Buttons</span>
                <div className="flex flex-wrap gap-1.5">
                  {BUTTON_HOVERS.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      aria-pressed={buttonHover === h.id}
                      title={h.blurb}
                      onClick={() => setButtonHover(h.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                        buttonHover === h.id ? "border-brand bg-brand/10 text-snow" : "border-edge text-mist hover:border-brand/60"
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-mist/70">
              {CONTAINER_HOVERS.find((h) => h.id === containerHover)?.blurb}{" "}
              {BUTTON_HOVERS.find((h) => h.id === buttonHover)?.blurb}
            </p>
          </div>
          <input type="hidden" name="containerHover" value={containerHover} />
          <input type="hidden" name="buttonHover" value={buttonHover} />
          <input type="hidden" name="buttonStyle" value={buttonStyle} />
        </Group>

        {/* 4 — How the containers are arranged on the page. */}
        <Group
          pane="layout" active={pane}
          title="Change container layout"
          hint="Where your sections sit. Your content doesn't move — only the arrangement does, so you can switch back any time."
        >
          <LayoutRow value={layout} onPick={setLayout} />
          <div className="mt-4 rounded-xl border border-edge p-4">
              <span className="label !mb-0">Your profile panel</span>
              <p className="mt-0.5 text-xs text-mist/70">
                Shown on every layout: pinned beside your offers on Storefront, centred above the page on the
                rest. Only the portrait is worth uploading, since your name comes from your account and the
                icon row from the socials you have already connected.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="btn-ghost cursor-pointer !py-2 text-sm">
                  {profileImg ? "Replace portrait" : "Upload portrait"}
                  <input
                    ref={profileFileRef}
                    type="file"
                    name="profileImageFile"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg"
                    className="hidden"
                    onChange={(e) => onPickFile(e, "profile")}
                  />
                </label>
                {profileImg && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={profileImg} alt="" className="h-10 w-10 rounded-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage("profile")}
                      className="btn-ghost !py-2 text-sm !text-brand2"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>

              <span className="label mt-4 !mb-1 block">Frame</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {FRAMES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={frame === f.id}
                    onClick={() => setFrame(f.id)}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      frame === f.id ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
                    }`}
                  >
                    <span className="block text-xs font-semibold">{f.label}</span>
                    <span className="mt-0.5 block text-[0.7rem] text-mist/70">{f.blurb}</span>
                  </button>
                ))}
              </div>
              <input type="hidden" name="profileFrame" value={frame} />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Handle</span>
                  <input
                    className="field"
                    name="profileHandle"
                    value={handle}
                    maxLength={40}
                    placeholder="@yourhandle"
                    onChange={(e) => setHandle(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="label">Under that</span>
                  <input
                    className="field"
                    name="profileLocation"
                    value={where}
                    maxLength={60}
                    placeholder="Brooklyn, NY"
                    onChange={(e) => setWhere(e.target.value)}
                  />
                </label>
              </div>
            </div>
          {layout !== "scroll" && layout !== "focus" && (
            <p className="rounded-xl bg-panel2 px-4 py-2.5 text-xs text-mist">
              Your hero, merch grid and video always run full width — they don&apos;t read well in half a column. On
              phones every layout stacks into one column.
            </p>
          )}
          <ScaleRow
            label="Section spacing"
            hint="How much air sits between your sections — the whole page keeps its own proportions."
            options={SPACINGS}
            value={spacing}
            onPick={setSpacing}
            kind="spacing"
          />
        </Group>

        {/* 5 — The words themselves. */}
        <Group pane="font" active={pane} title="Font" hint="The typeface, size and color of every word on your page.">
          <FontRow value={fontId} onPick={setFontId} />
          <TextSizeRow value={scale} onPick={setScale} family={getFont(fontId).family} />
          <SwatchRow
            label="Text color"
            swatches={palette.inks}
            value={palette.ink}
            onPick={palette.setInk}
            custom
            warn={
              isLight(palette.ink) === isLight(backdropBase)
                ? "This is about as bright as your backdrop — your words will be hard to read on it."
                : ""
            }
          />
        </Group>

        {/* 6 — Branding that lives outside the page itself.
            Shown with a mock browser tab so the 16px reality is obvious — a
            detailed logo that looks fine here will be a smudge there. */}
        <Group pane="icon" active={pane} title="Browser tab icon" hint="The little icon in the browser tab when someone opens your page.">
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
            {/* Which palette is on screen. Only worth saying when there are
                two of them; with one look the mode already said it. */}
            {colorMode === "auto" && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-mist/60">{editing} look</span>
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
              {/* The portrait, its frame, the handle and the location are all
                  page settings set from this very screen, and none of them used
                  to appear here — so picking a frame or typing a handle changed
                  nothing you could see until you saved and opened the page.
                  Drawn at preview scale rather than through the site-* classes,
                  which are sized for a real page. */}
              {profileImg && (
                <div
                  className="mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full"
                  style={previewFrameStyle}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profileImg}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
              )}
              <p className="text-center text-[1.6em] font-extrabold leading-tight">Your name here</p>
              {handle && (
                <p className="mt-0.5 text-center text-[0.85em] font-semibold" style={{ color: accent }}>
                  {handle}
                </p>
              )}
              {where && <p className="mt-0.5 text-center text-[0.75em] opacity-70">{where}</p>}
              <p className="mx-auto mt-1.5 max-w-[22em] text-center text-[0.8em] opacity-70">
                This is how your page will feel — your type, your colors, your layout.
              </p>
              <div className="mt-4 text-center">
                {/* Drawn from the same buttonVars the page's buttons read, so
                    the Buttons control is visible here rather than only after
                    saving. It painted a flat accent before, which made every
                    treatment but Solid look like it had done nothing. */}
                <span
                  className="inline-block px-4 py-1.5 text-[0.85em] font-semibold"
                  style={{
                    background: previewButton["--site-btn-bg"],
                    color: previewButton["--site-btn-ink"],
                    borderColor: previewButton["--site-btn-border"],
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderRadius: `${0.5 * Number(getCorner(corner)?.value ?? 1)}rem`,
                  }}
                >
                  Your button
                </span>
              </div>

              <PreviewSections
                layout={layout}
                cardStyle={previewCardStyle}
                width={previewCardWidth}
                minHeight={Number(clampMinHeight(minH))}
                rhythm={Number(getSpacing(spacing)?.value ?? 1)}
              />

              <p className="mt-6 border-t pt-3 text-center text-[0.7em] opacity-50" style={{ borderColor: "currentColor" }}>
                Your tagline goes here
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-mist/70">
            Colors, type and container shape are exactly what your page uses. Text and button alignment are set per
            section, in the Page Builder, so this shows the centred default.
          </p>
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
