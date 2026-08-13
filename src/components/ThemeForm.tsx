"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateTheme, type FormState } from "@/lib/actions";
import {
  ACCENTS,
  BACKGROUNDS,
  BORDER_STYLES,
  borderCss,
  CONTAINER_SIZES,
  CONTAINERS,
  DEFAULT_BORDER,
  DEFAULT_SIZE,
  type Swatch,
} from "@/lib/theme";
import { THEMES, themeCss } from "@/lib/themes";

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

function SwatchRow({
  label,
  hint,
  swatches,
  value,
  onPick,
  /** Dark base composited under translucent swatches so they stay visible. */
  base,
}: {
  label: string;
  hint?: string;
  swatches: Swatch[];
  value: string;
  onPick: (v: string) => void;
  base?: string;
}) {
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
      </div>
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
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateTheme, {});
  const [accent, setAccent] = useState(themeColor);
  const [bg, setBg] = useState(bgColor);
  const [card, setCard] = useState(cardColor);
  const [size, setSize] = useState(containerSize);
  const [border, setBorder] = useState(borderStyle);
  const [gradient, setGradient] = useState(gradientProp);
  const [themeId, setThemeId] = useState(themeIdProp);
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
    // Rolling a custom backdrop implies leaving any preset.
    setThemeId("");
    if (bgFileRef.current) bgFileRef.current.value = "";
  }

  /** Roll everything: colors, container styling AND a fresh random SVG background. */
  function rollAll() {
    const newAccent = randomOf(ACCENTS).value;
    setAccent(newAccent);
    setBg(randomOf(BACKGROUNDS).value);
    setCard(randomOf(CONTAINERS).value);
    setSize(randomOf(CONTAINER_SIZES).value);
    setBorder(randomOf(BORDER_STYLES).id);
    rollSvg(newAccent);
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
  const previewBg =
    `${gradient ? `radial-gradient(280px 150px at 50% -10%, ${accent}44, transparent 70%), ` : ""}` +
    `${bgImg ? `url("${bgImg}") center / cover no-repeat, ` : ""}${bg}`;
  const previewCard = `${cardImg ? `url("${cardImg}") center / cover no-repeat, ` : ""}${card}`;
  // An active preset owns the backdrop — in the preview and on the page.
  const previewStyle = themeCss(themeId, accent) ?? { background: previewBg };
  /** Thumbnail for the "Custom" preset tile — reflects the current custom picks. */
  const customTileStyle = {
    backgroundImage: `${gradient ? `radial-gradient(60px 30px at 50% -10%, ${accent}66, transparent 70%), ` : ""}${
      bgImg ? `url("${bgImg}") center / cover no-repeat` : "none"
    }`,
    backgroundColor: bg,
  };
  /** The preview card apes the chosen width against the widest option. */
  const widest = Math.max(...CONTAINER_SIZES.map((s) => Number(s.value)));
  const previewCardWidth = `${(Number(size) / widest) * 100}%`;
  /** Presets own the backdrop, so the custom backdrop controls go quiet. */
  const backdropOff = themeId ? "pointer-events-none select-none opacity-40" : "";

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <input type="hidden" name="themeColor" value={accent} />
      <input type="hidden" name="bgColor" value={bg} />
      <input type="hidden" name="cardColor" value={card} />
      <input type="hidden" name="containerSize" value={size} />
      <input type="hidden" name="borderStyle" value={border} />
      <input type="hidden" name="themeId" value={themeId} />
      <input type="hidden" name="bgSvg" value={bgSvg} />
      <input type="hidden" name="clearBgImage" value={clearBg ? "1" : ""} />
      <input type="hidden" name="clearCardImage" value={clearCard ? "1" : ""} />
      <input type="hidden" name="clearFavicon" value={clearIcon ? "1" : ""} />

      <div className="space-y-5">
        {/* 1 — What sits behind everything. */}
        <Group title="Backdrop" hint="The canvas your whole page sits on. Start from a preset or build your own.">
          <div>
            <span className="label !mb-0">Preset</span>
            <p className="mt-0.5 text-xs text-mist/70">
              A complete backdrop look. Pick <span className="text-snow">Custom</span> to design your own with the
              controls below.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {[{ id: "", name: "Custom" }, ...THEMES].map((t) => {
                const selected = themeId === t.id;
                return (
                  <button
                    key={t.id || "custom"}
                    type="button"
                    title={t.name}
                    aria-pressed={selected}
                    onClick={() => setThemeId(t.id)}
                    className={`overflow-hidden rounded-xl border text-left transition ${
                      selected ? "border-brand ring-1 ring-brand" : "border-edge hover:border-brand/60"
                    }`}
                  >
                    <div className="h-12 w-full" style={themeCss(t.id, accent) ?? customTileStyle} />
                    <p className="truncate px-2 py-1 text-[10px] font-medium">{t.name}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {themeId ? (
            <p className="rounded-xl bg-panel2 px-4 py-2.5 text-xs text-mist">
              The <span className="font-semibold text-snow">{THEMES.find((t) => t.id === themeId)?.name}</span> preset
              controls your backdrop — the background color, image and glow are ignored until you switch back to Custom.
              Container and accent choices still apply.
            </p>
          ) : null}

          <div className={backdropOff}>
            <SwatchRow label="Background color" swatches={BACKGROUNDS} value={bg} onPick={setBg} />
          </div>

          <div className={backdropOff}>
            <span className="label !mb-0">Background image</span>
            <p className="mt-0.5 text-xs text-mist/70">
              Optional — sits on top of your background color. Upload your own SVG or image, or roll a random abstract
              SVG in your colors.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="btn-ghost cursor-pointer !py-2 text-sm">
                Upload image
                <input
                  ref={bgFileRef}
                  type="file"
                  name="bgImageFile"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg"
                  className="hidden"
                  onChange={(e) => onPickFile(e, "bg")}
                />
              </label>
              <button type="button" onClick={() => rollSvg()} className="btn-ghost !py-2 text-sm">
                🎲 Random SVG
              </button>
              {bgImg && (
                <button type="button" onClick={() => removeImage("bg")} className="btn-ghost !py-2 text-sm !text-brand2">
                  Remove
                </button>
              )}
            </div>
          </div>

          <label
            className={`flex w-fit cursor-pointer items-center gap-2.5 text-sm ${backdropOff}`}
          >
            <input
              type="checkbox"
              name="gradient"
              checked={gradient}
              onChange={(e) => setGradient(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            Accent glow at the top of the page
          </label>
        </Group>

        {/* 2 — The boxes your content lives in. */}
        <Group title="Containers" hint="The cards and panels each section sits in — their tint, width and edges.">
          <SwatchRow
            label="Container color"
            hint="Shown over your backdrop, so the translucent tints pick up whatever is behind them."
            swatches={CONTAINERS}
            value={card}
            onPick={setCard}
            base={bg}
          />
          <SizeRow value={size} onPick={setSize} />
          <BorderRow value={border} onPick={setBorder} accent={accent} card={card} base={bg} />

          <div>
            <span className="label !mb-0">Container image</span>
            <p className="mt-0.5 text-xs text-mist/70">Optional texture behind your cards&apos; tint.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="btn-ghost cursor-pointer !py-2 text-sm">
                Upload image
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
          </div>
        </Group>

        {/* 3 — The one color that touches everything. */}
        <Group title="Accent" hint="Buttons, links, highlights and the accent border styles above.">
          <SwatchRow label="Accent color" swatches={ACCENTS} value={accent} onPick={setAccent} />
        </Group>

        {/* 4 — Branding that lives outside the page itself.
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
                <span aria-hidden className="text-xs text-mist/50">✕</span>
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
            <button type="button" onClick={rollAll} className="text-xs font-semibold text-mist hover:text-snow">
              🎲 Randomize
            </button>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-edge">
            <div className="flex min-h-80 flex-col justify-center p-6" style={previewStyle}>
              <p className="text-center text-xl font-extrabold text-white">Your name here</p>
              <p className="mt-1 text-center text-xs text-white/60">This is how your page will feel</p>
              <div
                className="mt-6 rounded-xl p-4"
                style={{
                  background: previewCard,
                  width: previewCardWidth,
                  marginInline: "auto",
                  ...borderCss(border, accent),
                }}
              >
                <p className="text-sm font-semibold text-white">A content card</p>
                <p className="mt-0.5 text-xs text-white/60">Bonus drops, merch, links…</p>
              </div>
              <div className="mt-6 text-center">
                <span
                  className="inline-block rounded-lg px-5 py-2 text-sm font-semibold text-white"
                  style={{ background: accent }}
                >
                  Your button
                </span>
              </div>
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
            <button className="btn-primary w-full" disabled={pending}>
              {pending ? "Saving…" : "Save theme"}
            </button>
            <p className="mt-2 text-center text-xs text-mist/70">
              {state.ok ? (
                <span className="font-semibold text-good">Saved — it&apos;s live on your page.</span>
              ) : (
                "Publishes to your live page."
              )}
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
