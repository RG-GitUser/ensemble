/**
 * The loading screen's twinkling stars, spread across the page behind
 * everything else. Fixed rather than scrolling, so it reads as a sky the
 * content moves over instead of confetti stuck to the page.
 *
 * Coordinates come from a seeded generator rather than Math.random, so the
 * field is identical on every render — no hydration mismatch, and no churn
 * in diffs. Reuses the `.ens-star` keyframes from globals.css.
 */

/** Deterministic 32-bit LCG — same sequence every time, unlike Math.random. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const VIEW_W = 1440;
const VIEW_H = 900;

/** [x, y, radius, duration(s), delay(s)] */
const STARS: Array<[number, number, number, number, number]> = (() => {
  const rnd = seeded(20260811);
  return Array.from({ length: 70 }, () => [
    +(rnd() * VIEW_W).toFixed(1),
    +(rnd() * VIEW_H).toFixed(1),
    +(0.7 + rnd() * 1.1).toFixed(2),
    +(4.5 + rnd() * 4.5).toFixed(2),
    +(-rnd() * 9).toFixed(2),
  ]);
})();

/**
 * A four-pointed glint on the unit circle — concave sides pinched toward the
 * middle, so it reads as a sparkle rather than a plus sign.
 *
 * Light mode uses these instead of circles. A violet circle on a near-white
 * page is a dot; at the same size a glint is a highlight, which is the thing
 * the dark theme's white specks are actually doing.
 */
const GLINT = "M0,-1 Q0.16,-0.16 1,0 Q0.16,0.16 0,1 Q-0.16,0.16 -1,0 Q-0.16,-0.16 0,-1 Z";

/** Sparser and larger than the dots — a glint carries further than a speck. */
const GLINTS = STARS.filter((_, i) => i % 2 === 0).map(([x, y, r, dur, delay]) => ({
  x,
  y,
  scale: +(r * 3.4).toFixed(2),
  dur,
  delay,
}));

export function Starfield() {
  return (
    <div
      aria-hidden
      // Behind every section, and never intercepting a click. The layer is
      // dimmed so the stars stay a texture rather than competing with copy —
      // `.ens-starfield` (globals.css) carries that, and lifts it in light
      // mode where violet specks need more presence than white ones do.
      className="ens-starfield pointer-events-none fixed inset-0 -z-10"
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        // "slice" keeps the stars circular at any aspect ratio; "none" would
        // stretch them into ellipses on wide or tall screens.
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Both shapes ship; globals.css shows one per theme. Rendering the
            pair costs a little markup and keeps the swap in CSS, where it
            can't cause a hydration mismatch. */}
        <g className="ens-dots">
          {STARS.map(([x, y, r, dur, delay], i) => (
            <circle
              key={i}
              className="ens-star"
              cx={x}
              cy={y}
              r={r}
              // --color-spark, not --color-snow: white specks vanish on a
              // light page, so the light theme swaps this for brand violet.
              fill="var(--color-spark)"
              style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
            />
          ))}
        </g>
        <g className="ens-sparkles">
          {GLINTS.map((g, i) => (
            <path
              key={i}
              className="ens-star"
              d={GLINT}
              fill="var(--color-spark)"
              transform={`translate(${g.x} ${g.y}) scale(${g.scale})`}
              style={{ animationDuration: `${g.dur}s`, animationDelay: `${g.delay}s` }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
