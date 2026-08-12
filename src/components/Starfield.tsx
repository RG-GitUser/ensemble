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

export function Starfield() {
  return (
    <div
      aria-hidden
      // Behind every section, and never intercepting a click. The whole layer
      // is dimmed so the stars stay a texture rather than competing with copy.
      className="pointer-events-none fixed inset-0 -z-10 opacity-45"
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        // "slice" keeps the stars circular at any aspect ratio; "none" would
        // stretch them into ellipses on wide or tall screens.
        preserveAspectRatio="xMidYMid slice"
      >
        {STARS.map(([x, y, r, dur, delay], i) => (
          <circle
            key={i}
            className="ens-star"
            cx={x}
            cy={y}
            r={r}
            // --color-spark, not --color-snow: white specks vanish on a light
            // page, so the light theme swaps this for the brand violet.
            fill="var(--color-spark)"
            style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
