"use client";

import { useState } from "react";
import { BULLET_SHAPES, DEFAULT_BULLET_SHAPE, DEFAULT_MARKER, DEFAULT_MARKER_POSITION, MARKER_MODES, MARKER_POSITIONS } from "@/lib/theme";

/**
 * How this section's rows are marked.
 *
 * One setting with four modes instead of a bullet picker beside a numbering
 * switch, because they answer the same question: what sits to the left of each
 * row. Drawn as tiles showing the first three rows as they would actually
 * read, since "Lettered" means nothing next to "Numbered" until you see A, B, C
 * against 1, 2, 3.
 *
 * The shape row only appears for bullets, because it only means anything there.
 */
export function SectionMarkerField({
  mode: modeProp,
  shape: shapeProp,
  position: positionProp,
  scope,
}: {
  mode: string;
  shape: string;
  /** Only meaningful for the section scope; rows have nowhere else to go. */
  position?: string;
  /**
   * "rows" marks each row inside a list section; "section" marks the section
   * itself, above its heading. Same four modes and the same three shapes,
   * because it is the same decision at two scales.
   */
  scope: "rows" | "section";
}) {
  const [mode, setMode] = useState(modeProp || DEFAULT_MARKER);
  const [shape, setShape] = useState(shapeProp || DEFAULT_BULLET_SHAPE);
  const [position, setPosition] = useState(
    positionProp || ((modeProp || DEFAULT_MARKER) === "bullet" ? "corner" : DEFAULT_MARKER_POSITION)
  );
  const nameMode = scope === "rows" ? "markerMode" : "sectionMarker";
  const nameShape = scope === "rows" ? "bulletShape" : "sectionBulletShape";

  return (
    <div>
      <span className="label !mb-0">{scope === "rows" ? "Row markers" : "Section accent"}</span>
      <p className="mt-0.5 text-xs text-mist/70">
        {scope === "rows"
          ? "What sits to the left of each row in this section."
          : "A marker above this section's heading. Sections count within their own mode, so three numbered ones read 01, 02, 03 whatever else is on the page."}
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MARKER_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`border p-2.5 text-left transition ${
              mode === m.id ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
            }`}
          >
            <span className="flex h-11 flex-col justify-center gap-1.5">
              {m.sample.map((sample, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="w-4 text-[13px] font-bold leading-none text-brand">{sample}</span>
                  <span className="h-1 flex-1 bg-mist/30" />
                </span>
              ))}
            </span>
            <span className="mt-3.5 block text-xs font-semibold">{m.label}</span>
            <span className="block text-[10px] text-mist">{m.blurb}</span>
          </button>
        ))}
      </div>

      {mode === "bullet" && (
        <div className="mt-3">
          <span className="label !mb-1 block">Bullet shape</span>
          <div className="flex flex-wrap gap-2">
            {BULLET_SHAPES.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={shape === b.id}
                onClick={() => setShape(b.id)}
                className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-semibold transition ${
                  shape === b.id ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
                }`}
              >
                <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden>
                  <path d={b.path} fill="currentColor" className="text-brand" />
                </svg>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Every mode chooses, bullets included. A bullet that never chose still
          resolves to the corner on the page, so nothing written before this
          moves — see resolveMarkerPosition. */}
      {scope === "section" && mode !== "none" && (
        <div className="mt-3">
          <span className="label !mb-1 block">Position</span>
          <div className="flex flex-wrap gap-2">
            {MARKER_POSITIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={position === p.id}
                onClick={() => setPosition(p.id)}
                className={`border px-3 py-2 text-left text-xs transition ${
                  position === p.id ? "border-brand bg-brand/10" : "border-edge hover:border-brand/60"
                }`}
              >
                <span className="block font-semibold">{p.label}</span>
                <span className="block text-[10px] text-mist">{p.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {scope === "section" && <input type="hidden" name="markerPosition" value={position} />}
      <input type="hidden" name={nameMode} value={mode} />
      <input type="hidden" name={nameShape} value={shape} />
    </div>
  );
}
