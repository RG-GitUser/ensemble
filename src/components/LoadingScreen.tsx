/**
 * Loading screen — the Ensemble wordmark still and steady at the center of a
 * twinkling star field, ringed by a sweeping gradient arc so it reads as
 * progress rather than decoration. The wordmark is real text in the site
 * font, styled like the header logo ("En" in snow, "semble" in the brand
 * gradient), so it stays crisp at any size. It deliberately carries no
 * animation of its own — the motion lives in the stars and the arc.
 *
 * Star coordinates are hard-coded rather than generated, so server and client
 * render byte-identical markup and there is no hydration mismatch. Keyframes
 * live in globals.css under `.ens-*` and are frozen by prefers-reduced-motion.
 */

/**
 * [x, y, radius, duration(s)] — faint stars inside the ring.
 * Durations vary so the twinkle never falls into a visible rhythm.
 */
const STARS: Array<[number, number, number, number]> = [
  [70, 52, 0.7, 5.2],
  [132, 44, 0.6, 7.1],
  [160, 96, 0.8, 6.3],
  [143, 118, 0.5, 4.8],
  [122, 150, 0.7, 6.8],
  [86, 146, 0.6, 5.6],
  [52, 110, 0.8, 7.4],
  [58, 84, 0.5, 5.9],
  [95, 72, 0.6, 6.6],
  [118, 102, 0.5, 4.6],
  [76, 118, 0.7, 7.8],
  [146, 72, 0.6, 5.4],
  [100, 22, 0.7, 6.1],
  [35, 65, 0.5, 7.6],
  [162, 140, 0.6, 5.0],
  [100, 176, 0.6, 6.9],
  [40, 135, 0.5, 5.7],
  [166, 62, 0.5, 7.2],
];

/** Ring radius for the sweeping arc, and the arc length as a dash pattern. */
const RING = 88;
const CIRCUMFERENCE = 2 * Math.PI * RING;
const ARC = CIRCUMFERENCE * 0.18;


export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-7 px-6 py-20"
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        {/* Soft wash behind the mark, matching the primary-button gradient.
            A CSS radial is cheaper than an SVG blur filter at this size. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -m-12 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(167,0,204,0.28), rgba(106,18,171,0.12) 55%, transparent 75%)",
          }}
        />

        <svg viewBox="0 0 200 200" className="relative h-56 w-56 sm:h-72 sm:w-72" aria-hidden>
          <defs>
            <linearGradient id="ens-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-brand)" />
              <stop offset="100%" stopColor="var(--color-brand2)" />
            </linearGradient>
            <linearGradient id="ens-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--color-brand2)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--color-brand2)" />
            </linearGradient>
          </defs>

          {/* Track the sweep runs on, so the arc reads as travelling a path. */}
          <circle
            cx="100"
            cy="100"
            r={RING}
            fill="none"
            stroke="var(--color-edge)"
            strokeWidth="1"
            opacity="0.5"
          />
          <circle
            className="ens-sweep"
            cx="100"
            cy="100"
            r={RING}
            fill="none"
            stroke="url(#ens-arc)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${CIRCUMFERENCE - ARC}`}
          />

          {STARS.map(([x, y, r, dur], i) => (
            <circle
              key={`s${i}`}
              className="ens-star"
              cx={x}
              cy={y}
              r={r}
              fill="var(--color-snow)"
              style={{ animationDuration: `${dur}s`, animationDelay: `${-i * 0.7}s` }}
            />
          ))}

          <text
            x="100"
            y="100"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="27"
            fontWeight="800"
            letterSpacing="-0.5"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            <tspan fill="var(--color-snow)">En</tspan>
            <tspan fill="url(#ens-line)">semble</tspan>
          </text>
        </svg>
      </div>

      <p className="ens-label text-xs font-semibold uppercase tracking-[0.28em] text-mist">{label}</p>
    </div>
  );
}
