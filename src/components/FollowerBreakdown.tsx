import Link from "next/link";
import { getPlatform, iconFill, isNearBlackBrand } from "@/lib/social";
import { logFollowerCounts, deleteFollowerCount } from "@/lib/actions";
import {
  buildSeries,
  compact,
  dayLabel,
  lastDays,
  longDay,
  platformsSeen,
  previousReading,
  todayISO,
} from "@/lib/followers";
import type { FollowerReading, FollowerSnapshot, SocialAccount } from "@/lib/types";

const CHART_DAYS = 30;

function PlatformIcon({ id, size = 16 }: { id: string; size?: number }) {
  const p = getPlatform(id);
  if (!p) return null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d={p.iconPath} fill={iconFill(p.color)} />
    </svg>
  );
}

/**
 * Colour for a filled chart band.
 *
 * iconFill solves this for glyphs on the dark UI: it lightens a near-black
 * brand to near-white so the mark shows. A band is the opposite problem —
 * near-white vanishes against the light theme's white card. Those brands use
 * --color-spark instead, the token that flips with the theme precisely so it
 * stays visible against whichever background is behind it.
 */
function bandColor(id: string): string {
  const p = getPlatform(id);
  if (!p) return "var(--color-brand)";
  return isNearBlackBrand(p.color) ? "var(--color-spark)" : p.color;
}

function platformName(id: string): string {
  return getPlatform(id)?.name ?? id;
}

/** Signed change, or a dash when there's nothing to compare against. */
function Delta({ from, to }: { from: number | null; to: number }) {
  if (from === null) return <span className="text-mist">—</span>;
  const diff = to - from;
  if (diff === 0) return <span className="text-mist">no change</span>;
  return (
    <span className={diff > 0 ? "text-good" : "text-brand2"}>
      {diff > 0 ? "+" : "−"}
      {compact(Math.abs(diff))}
    </span>
  );
}

export function FollowerBreakdown({
  history,
  readings,
  accounts,
  on,
  error,
}: {
  history: FollowerSnapshot[];
  readings: FollowerReading[];
  accounts: SocialAccount[];
  /** The date being asked about, YYYY-MM-DD. */
  on: string;
  error?: string;
}) {
  const today = todayISO();
  const days = lastDays(CHART_DAYS);
  const series = buildSeries(history, days);
  const peak = Math.max(1, ...series.map((p) => p.total));
  const order = platformsSeen(history);
  const totalOn = readings.reduce((s, r) => s + r.count, 0);

  // A reading dated before the chart's window still sets the level inside it,
  // so "has any history" can't be answered from the visible bars alone.
  const hasHistory = history.length > 0;

  const logForm = (
    <div className="card mt-6" id="log">
      <h2 className="font-bold">Record today&apos;s counts</h2>
      <p className="mt-1 text-sm text-mist">
        Enter what each platform shows you. Pick an earlier date to fill in a day you missed — entering a date twice
        corrects it rather than adding a second reading.
      </p>

      {accounts.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-edge bg-panel2 px-4 py-3 text-sm text-mist">
          No social accounts connected yet. <Link href="/dashboard/socials" className="text-brand hover:underline">Connect
          one in Socials</Link> and it will show up here to track.
        </p>
      ) : (
        <form action={logFollowerCounts} className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((a) => (
              <label key={a.platform} className="flex items-center gap-2.5 rounded-xl border border-edge bg-panel2 px-3 py-2">
                <PlatformIcon id={a.platform} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {platformName(a.platform)}
                  <span className="ml-1 text-mist">@{a.handle}</span>
                </span>
                <input
                  type="number"
                  name={`count_${a.platform}`}
                  min={0}
                  step={1}
                  placeholder="—"
                  aria-label={`${platformName(a.platform)} followers`}
                  className="w-24 rounded-lg border border-edge bg-ink px-2 py-1 text-right text-sm"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-mist">
              Date{" "}
              <input
                type="date"
                name="day"
                defaultValue={on}
                max={today}
                className="rounded-lg border border-edge bg-ink px-2 py-1 text-sm text-snow"
              />
            </label>
            <button className="btn-primary !py-2 text-sm">Save counts</button>
            {error === "empty" && <span className="text-sm text-warn">Nothing saved — every field was blank.</span>}
            {error === "future" && <span className="text-sm text-warn">That date is in the future.</span>}
          </div>
        </form>
      )}
    </div>
  );

  if (!hasHistory) {
    return (
      <>
        <div className="card mt-6 border-dashed text-center">
          <p className="font-bold">No follower history yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-mist">
            Record your counts below and this fills in — a chart of your following over time, and the numbers as they
            stood on any date you pick.
          </p>
        </div>
        {logForm}
      </>
    );
  }

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card !p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-mist">Followers on this date</p>
          <p className="mt-1.5 text-xl font-bold">{compact(totalOn)}</p>
          <p className="text-xs text-mist">{longDay(on)}</p>
        </div>
        <div className="card !p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-mist">Platforms tracked</p>
          <p className="mt-1.5 text-xl font-bold">{order.length}</p>
          <p className="text-xs text-mist">{history.length} readings recorded</p>
        </div>
        <div className="card !p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-mist">Across {CHART_DAYS} days</p>
          <p className="mt-1.5 text-xl font-bold">
            <Delta from={series[0].total || null} to={series[series.length - 1].total} />
          </p>
          <p className="text-xs text-mist">
            {compact(series[0].total)} → {compact(series[series.length - 1].total)}
          </p>
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold">Followers — last {CHART_DAYS} days</h2>
          <span className="text-xs text-mist">stacked by platform</span>
        </div>
        {/* Each bar is the platforms stacked, so the column height is the total
            and each band is that platform's share of it on that day. */}
        <div className="mt-5 flex h-36 items-end gap-[3px]">
          {series.map((point) => (
            <div
              key={point.day}
              title={`${dayLabel(point.day)}: ${point.total} total${order
                .filter((p) => point.byPlatform[p])
                .map((p) => `\n${platformName(p)}: ${point.byPlatform[p]}`)
                .join("")}`}
              className="flex h-full flex-1 flex-col justify-end"
            >
              {order.map((p, band) => {
                const v = point.byPlatform[p] ?? 0;
                if (!v) return null;
                return (
                  <div
                    key={p}
                    style={{
                      height: `${(v / peak) * 100}%`,
                      background: bandColor(p),
                      // Brand colours weren't picked to sit next to each other —
                      // Instagram's pink against YouTube's red reads as one
                      // band without a seam. The card colour is the seam, so it
                      // stays a gap rather than a line in either theme.
                      borderTop: band === 0 ? undefined : "1px solid var(--color-panel)",
                    }}
                    className="w-full first:rounded-t"
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-mist">
          <span>{dayLabel(series[0].day)}</span>
          <span>{dayLabel(series[series.length - 1].day)}</span>
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-mist">
          {order.map((p) => (
            <li key={p} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: bandColor(p) }}
                aria-hidden
              />
              {platformName(p)}
            </li>
          ))}
        </ul>
      </div>

      <div className="card mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-bold">Breakdown on a date</h2>
            <p className="mt-1 text-sm text-mist">Pick any date to see where each platform stood.</p>
          </div>
          {/* Plain GET form: the date lives in the URL, so a particular day is
              a link somebody can bookmark or send on. */}
          <form method="GET" action="/dashboard/analytics" className="flex items-center gap-2">
            <input type="hidden" name="tab" value="followers" />
            <input
              type="date"
              name="on"
              defaultValue={on}
              max={today}
              className="rounded-lg border border-edge bg-ink px-2 py-1.5 text-sm text-snow"
            />
            <button className="btn-ghost !py-1.5 text-sm">Show</button>
          </form>
        </div>

        {readings.length === 0 ? (
          <p className="mt-4 text-sm text-mist">
            Nothing had been recorded yet on {longDay(on)} — your first reading came later.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-xs uppercase tracking-wide text-mist">
                <th className="pb-2 font-medium">Platform</th>
                <th className="pb-2 text-right font-medium">Followers</th>
                <th className="pb-2 text-right font-medium">Change</th>
                <th className="pb-2 text-right font-medium">Measured</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {readings.map((r) => {
                const prev = previousReading(history, r.platform, r.measuredOn);
                const exact = r.measuredOn === on;
                return (
                  <tr key={r.platform}>
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <PlatformIcon id={r.platform} />
                        {platformName(r.platform)}
                      </span>
                    </td>
                    <td className="py-2 text-right font-semibold">{r.count.toLocaleString()}</td>
                    <td className="py-2 text-right">
                      <Delta from={prev?.count ?? null} to={r.count} />
                    </td>
                    <td className="py-2 text-right text-mist">
                      {/* Said plainly when the figure predates the date asked
                          about — the count is carried forward, not measured. */}
                      {exact ? longDay(r.measuredOn) : `${longDay(r.measuredOn)} (carried)`}
                    </td>
                    <td className="py-2 text-right">
                      {exact && (
                        <form action={deleteFollowerCount}>
                          <input type="hidden" name="platform" value={r.platform} />
                          <input type="hidden" name="day" value={r.measuredOn} />
                          <button className="text-xs text-mist transition hover:text-brand2">Remove</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {readings.some((r) => r.measuredOn !== on) && (
          <p className="mt-3 text-xs text-mist">
            &ldquo;Carried&rdquo; means nothing was recorded on {longDay(on)} itself, so the last count taken before it
            is shown.
          </p>
        )}
      </div>

      {logForm}
    </>
  );
}
