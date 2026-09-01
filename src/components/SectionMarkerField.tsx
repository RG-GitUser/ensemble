"use client";

import { useState } from "react";
import { BULLET_SHAPES, DEFAULT_BULLET_SHAPE, DEFAULT_MARKER, MARKER_MODES } from "@/lib/theme";

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
  numbered,
}: {
  mode: string;
  shape: string;
  numbered: boolean;
}) {
  const [mode, setMode] = useState(modeProp || DEFAULT_MARKER);
  const [shape, setShape] = useState(shapeProp || DEFAULT_BULLET_SHAPE);

  return (
    <div className="border-t border-edge pt-4">
      <span className="label !mb-0">Row markers</span>
      <p className="mt-0.5 text-xs text-mist/70">What sits to the left of each row in this section.</p>

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
            <span className="flex h-8 flex-col justify-center gap-1">
              {m.sample.map((sample, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="w-3 text-[10px] font-bold text-brand">{sample}</span>
                  <span className="h-1 flex-1 bg-mist/30" />
                </span>
              ))}
            </span>
            <span className="mt-2 block text-xs font-semibold">{m.label}</span>
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

      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" name="numbered" defaultChecked={numbered} className="h-4 w-4 accent-brand" />
        <span className="text-mist">Also number this section on the page</span>
      </label>

      <input type="hidden" name="markerMode" value={mode} />
      <input type="hidden" name="bulletShape" value={shape} />
    </div>
  );
}
