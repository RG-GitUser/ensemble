"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateTheme, type FormState } from "@/lib/actions";
import { ACCENTS, BACKGROUNDS, CONTAINERS, type Swatch } from "@/lib/theme";
import { THEMES, themeCss } from "@/lib/themes";

function SwatchRow({
  label,
  swatches,
  value,
  onPick,
  /** Dark base composited under translucent swatches so they stay visible. */
  base,
}: {
  label: string;
  swatches: Swatch[];
  value: string;
  onPick: (v: string) => void;
  base?: string;
}) {
  return (
    <div>
      <span className="label">{label}</span>
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

/** The page builder's Design tab — presets, colors, images, gradient and randomizers. */
export function ThemeForm({
  themeColor,
  bgColor,
  cardColor,
  bgImage,
  cardImage,
  gradient: gradientProp,
  themeId: themeIdProp,
}: {
  themeColor: string;
  bgColor: string;
  cardColor: string;
  bgImage: string;
  cardImage: string;
  gradient: boolean;
  /** Active preset backdrop id ("" = custom/Midnight). */
  themeId: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateTheme, {});
  const [accent, setAccent] = useState(themeColor);
  const [bg, setBg] = useState(bgColor);
  const [card, setCard] = useState(cardColor);
  const [gradient, setGradient] = useState(gradientProp);
  const [themeId, setThemeId] = useState(themeIdProp);
  /** What the preview shows: saved URL, object URL of a picked file, or a generated data URI. */
  const [bgImg, setBgImg] = useState<string>(bgImage);
  const [cardImg, setCardImg] = useState<string>(cardImage);
  /** Pending generated SVG markup, submitted for server-side storage. */
  const [bgSvg, setBgSvg] = useState("");
  const [clearBg, setClearBg] = useState(false);
  const [clearCard, setClearCard] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const cardFileRef = useRef<HTMLInputElement>(null);

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

  /** Roll everything: colors AND a fresh random SVG background. */
  function rollAll() {
    const newAccent = randomOf(ACCENTS).value;
    setAccent(newAccent);
    setBg(randomOf(BACKGROUNDS).value);
    setCard(randomOf(CONTAINERS).value);
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
  /** Thumbnail for the "Midnight (custom)" tile — reflects the current custom picks. */
  const customTileStyle = {
    backgroundImage: `${gradient ? `radial-gradient(60px 30px at 50% -10%, ${accent}66, transparent 70%), ` : ""}${
      bgImg ? `url("${bgImg}") center / cover no-repeat` : "none"
    }`,
    backgroundColor: bg,
  };

  return (
    <form action={formAction} className="card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Page theme</h2>
          <p className="mt-1 text-sm text-mist">
            Colors, images and effects — the preview shows your combo instantly. Available on every plan.
          </p>
        </div>
        <button type="button" onClick={rollAll} className="btn-ghost !py-2 text-sm">
          🎲 Randomize everything
        </button>
      </div>

      <input type="hidden" name="themeColor" value={accent} />
      <input type="hidden" name="bgColor" value={bg} />
      <input type="hidden" name="cardColor" value={card} />
      <input type="hidden" name="themeId" value={themeId} />
      <input type="hidden" name="bgSvg" value={bgSvg} />
      <input type="hidden" name="clearBgImage" value={clearBg ? "1" : ""} />
      <input type="hidden" name="clearCardImage" value={clearCard ? "1" : ""} />

      {/* Preset backdrops — previewed live, saved with the same button. */}
      <div>
        <span className="label">Theme preset</span>
        <p className="mt-0.5 text-xs text-mist/70">
          A complete backdrop look. Pick <span className="text-snow">Custom</span> to design your own with the controls
          below.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
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

      <div className="grid gap-6 sm:grid-cols-[1fr_16rem]">
        <div className="space-y-5">
          {themeId && (
            <p className="rounded-xl bg-panel2 px-4 py-2.5 text-xs text-mist">
              The <span className="font-semibold text-snow">{THEMES.find((t) => t.id === themeId)?.name}</span> preset
              controls your backdrop — the background color, image and glow below are ignored until you switch back to
              Custom. Accent and container choices still apply.
            </p>
          )}
          <div className={themeId ? "pointer-events-none select-none opacity-40" : ""}>
            <SwatchRow label="Background" swatches={BACKGROUNDS} value={bg} onPick={setBg} />
          </div>
          <SwatchRow label="Containers" swatches={CONTAINERS} value={card} onPick={setCard} base={bg} />
          <SwatchRow label="Accent" swatches={ACCENTS} value={accent} onPick={setAccent} />

          <div className={themeId ? "pointer-events-none select-none opacity-40" : ""}>
            <span className="label">Background image</span>
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

          <div>
            <span className="label">Container image</span>
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
                <button type="button" onClick={() => removeImage("card")} className="btn-ghost !py-2 text-sm !text-brand2">
                  Remove
                </button>
              )}
            </div>
          </div>

          <label
            className={`flex w-fit cursor-pointer items-center gap-2.5 text-sm ${
              themeId ? "pointer-events-none select-none opacity-40" : ""
            }`}
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
        </div>

        <div className="overflow-hidden rounded-xl border border-edge">
          <div className="flex h-full flex-col justify-center p-5" style={previewStyle}>
            <p className="text-center text-base font-extrabold text-white">Your name here</p>
            <p className="mt-0.5 text-center text-[10px] text-white/60">This is how your page will feel</p>
            <div className="mt-4 rounded-lg border border-white/10 p-3" style={{ background: previewCard }}>
              <p className="text-xs font-semibold text-white">A content card</p>
              <p className="text-[10px] text-white/60">Bonus drops, merch, links…</p>
            </div>
            <div className="mt-4 text-center">
              <span
                className="inline-block rounded-lg px-4 py-1.5 text-xs font-semibold text-white"
                style={{ background: accent }}
              >
                Your button
              </span>
            </div>
          </div>
        </div>
      </div>

      {state.error && (
        <p className="rounded-xl border border-brand2/40 bg-brand2/10 px-4 py-2.5 text-sm text-brand2">{state.error}</p>
      )}
      <div className="flex items-center gap-3">
        <button className="btn-primary !py-2 text-sm" disabled={pending}>
          {pending ? "Saving…" : "Save theme"}
        </button>
        {state.ok && <span className="text-sm font-semibold text-good">Theme saved — it&apos;s live on your page.</span>}
      </div>
    </form>
  );
}
