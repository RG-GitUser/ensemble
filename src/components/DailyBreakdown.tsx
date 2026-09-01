import { formatCount, getMetric, getPlatform, iconFill, METRICS } from "@/lib/social";
import type { LatestStat } from "@/lib/db";

/**
 * A quick read on where every number stands today.
 *
 * One tile per metric a creator actually logs, summed across their platforms,
 * with the change since the reading before it. Metrics they have never logged
 * are left out rather than shown as zero, because an empty tile reads as a
 * number that fell to nothing rather than one nobody has recorded.
 *
 * Each metric carries its own colour, which is the point: a wall of identical
 * grey tiles is exactly what makes a dashboard hard to scan.
 */
export function DailyBreakdown({ stats }: { stats: LatestStat[] }) {
  const groups = METRICS.map((m) => {
    const rows = stats.filter((s) => s.metric === m.id);
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    const priorKnown = rows.filter((r) => r.previous !== null);
    const prior = priorKnown.reduce((sum, r) => sum + (r.previous ?? 0), 0);
    const delta = priorKnown.length ? total - prior : null;
    const newest = rows.reduce((d, r) => (r.day > d ? r.day : d), "");
    return { m, rows, total, delta, newest };
  }).filter((g) => g.rows.length > 0);

  if (groups.length === 0) {
    return (
      <div className="card mt-6 !p-5">
        <h2 className="font-bold">Daily breakdown</h2>
        <p className="mt-1 text-sm text-mist">
          Nothing logged yet. Record your follower, like and view counts in Analytics and this fills in, so you can see
          at a glance where every number stands.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold">Daily breakdown</h2>
        <span className="text-xs text-mist">Latest readings across your platforms</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(({ m, rows, total, delta, newest }) => (
          <div key={m.id} className="card !p-4">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-xs font-semibold uppercase tracking-wide ${m.tone}`}>{m.label}</p>
              {delta !== null && delta !== 0 && (
                <span className={`text-xs font-bold ${delta > 0 ? "text-good" : "text-brand2"}`}>
                  {delta > 0 ? "+" : ""}
                  {formatCount(delta)}
                </span>
              )}
            </div>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{formatCount(total)}</p>
            <p className="text-xs text-mist">
              across {rows.length} platform{rows.length === 1 ? "" : "s"} · as of {newest}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {rows.map((r) => {
                const p = getPlatform(r.platform);
                if (!p) return null;
                return (
                  <span
                    key={r.platform}
                    title={`${p.name}: ${r.count.toLocaleString("en-US")} ${getMetric(m.id)?.unit ?? ""}`}
                    className="inline-flex items-center gap-1 border border-edge px-1.5 py-0.5 text-[10px] text-mist"
                  >
                    <svg viewBox="0 0 24 24" width={11} height={11} aria-hidden>
                      <path d={p.iconPath} fill={iconFill(p.color)} />
                    </svg>
                    {formatCount(r.count)}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
