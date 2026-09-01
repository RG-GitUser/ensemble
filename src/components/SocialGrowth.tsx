"use client";

import { useState } from "react";
import { useActionState } from "react";
import { addSocialStat, removeSocialStat, type FormState } from "@/lib/actions";
import { DEFAULT_METRIC, formatCount, getMetric, getPlatform, iconFill, METRICS, PLATFORMS, type PlatformDef } from "@/lib/social";
import type { SocialAccount, SocialStat } from "@/lib/types";

function PlatformIcon({ platform, size = 16 }: { platform: PlatformDef; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d={platform.iconPath} fill={iconFill(platform.color)} />
    </svg>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-08-01" → "Aug 1, 2025", without toLocaleDateString's locale drift. */
function prettyDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

/** Exact count with separators, fixed locale so SSR and client agree. */
function exact(n: number): string {
  return n.toLocaleString("en-US");
}

function Delta({ from, to }: { from: number; to: number }) {
  const diff = to - from;
  if (diff === 0) return <span className="text-mist">±0</span>;
  return (
    <span className={diff > 0 ? "text-good" : "text-brand2"}>
      {diff > 0 ? "+" : "−"}
      {exact(Math.abs(diff))}
    </span>
  );
}

/**
 * The line itself. Points sit where their dates fall, not at even steps, so a
 * gap in the record reads as a gap. Height is normalised between the lowest
 * and highest count with a little headroom; vector-effect keeps the stroke
 * from being smeared by preserveAspectRatio="none".
 */
function Sparkline({ stats }: { stats: SocialStat[] }) {
  if (stats.length < 2) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-edge px-3 py-4 text-center text-xs text-mist">
        Add a second date and the growth curve draws itself.
      </p>
    );
  }
  const times = stats.map((s) => Date.parse(s.day));
  const counts = stats.map((s) => s.count);
  const [t0, t1] = [Math.min(...times), Math.max(...times)];
  const [c0, c1] = [Math.min(...counts), Math.max(...counts)];
  const x = (t: number) => (t1 === t0 ? 50 : ((t - t0) / (t1 - t0)) * 100);
  const y = (c: number) => (c1 === c0 ? 16 : 29 - ((c - c0) / (c1 - c0)) * 26);
  const points = stats.map((s) => `${x(Date.parse(s.day)).toFixed(2)},${y(s.count).toFixed(2)}`).join(" ");
  return (
    <div className="mt-3">
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-24 w-full" aria-hidden>
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {stats.map((s) => (
          <circle
            key={s.id}
            cx={x(Date.parse(s.day))}
            cy={y(s.count)}
            r={1.2}
            fill="var(--color-brand)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-mist">
        <span>{prettyDay(stats[0].day)}</span>
        <span>{prettyDay(stats[stats.length - 1].day)}</span>
      </div>
    </div>
  );
}

function AddForm({ accounts, defaultPlatform }: { accounts: SocialAccount[]; defaultPlatform: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addSocialStat, {});
  const connected = new Set(accounts.map((a) => a.platform));
  // Connected platforms first — they're what a creator is most likely tracking.
  const ordered = [...PLATFORMS].sort((a, b) => Number(connected.has(b.id)) - Number(connected.has(a.id)));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="mt-4 border-t border-edge pt-4">
      <p className="text-sm font-semibold">Log a count</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select name="platform" defaultValue={defaultPlatform} className="field w-auto !py-2 text-sm">
          {ordered.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {connected.has(p.id) ? " ✓" : ""}
            </option>
          ))}
        </select>
        {/* Which number this is. Followers first, because it is the one
            everybody tracks and what every reading used to be. */}
        <select name="metric" defaultValue={DEFAULT_METRIC} className="field w-auto !py-2 text-sm">
          {METRICS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <input name="day" type="date" defaultValue={today} max={today} required className="field w-auto !py-2 text-sm" />
        <input name="count" required className="field w-28 flex-1 !py-2 text-sm" placeholder="10k / 10,000" />
        <input name="note" maxLength={200} className="field flex-[2] !py-2 text-sm" placeholder="Details (optional) — collab, viral post…" />
        <button className="btn-primary !py-2 text-sm" disabled={pending}>
          {pending ? "…" : "Add"}
        </button>
      </div>
      {state.error && <p className="mt-2 text-xs text-brand2">{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs font-semibold text-good">Logged.</p>}
      <p className="mt-2 text-xs text-mist/70">
        Backfilling old milestones is the point — pick any past date. A second entry on the same date replaces the
        first, so typos are one re-entry away.
      </p>
    </form>
  );
}

/**
 * Manual follower-count log, charted per platform. Manual because it has to
 * be: most connections store a handle and nothing else, so there is no API to
 * ask — and a number the creator types on a date they choose also lets them
 * backfill their history from screenshots and old analytics.
 */
export function SocialGrowth({ accounts, stats }: { accounts: SocialAccount[]; stats: SocialStat[] }) {
  // Platforms with data, keeping PLATFORMS' popularity order for the chips.
  const tracked = PLATFORMS.filter((p) => stats.some((s) => s.platform === p.id));
  const [sel, setSel] = useState<string | null>(null);
  // Which number is on the chart. A platform's follower line and its view line
  // are different scales entirely, so they are never drawn together.
  const [metricSel, setMetricSel] = useState<string>(DEFAULT_METRIC);
  const selected = (sel && tracked.find((p) => p.id === sel)) || tracked[0] || null;
  // Metrics this platform actually has readings for, so the chips never offer
  // an empty chart.
  const metricsHere = METRICS.filter((m) => stats.some((s) => s.platform === selected?.id && s.metric === m.id));
  const metric = metricsHere.find((m) => m.id === metricSel) ?? metricsHere[0] ?? null;
  const series = selected && metric ? stats.filter((s) => s.platform === selected.id && s.metric === metric.id) : [];
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];

  return (
    <div className="card">
      <h2 className="font-bold">Growth tracker</h2>
      <p className="mt-1 text-sm text-mist">
        Log your follower counts on the dates they happened and watch each channel climb.
      </p>

      {tracked.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tracked.map((p) => {
            const s = stats.filter((x) => x.platform === p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSel(p.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selected?.id === p.id ? "border-brand bg-brand/10" : "border-edge bg-panel2 hover:border-brand/40"
                }`}
              >
                <PlatformIcon platform={p} size={13} />
                {p.name}
                <span className="text-mist">{formatCount(s[s.length - 1].count)}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected && latest && (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-2xl font-bold">
              {exact(latest.count)}
              <span className="ml-2 text-sm font-normal text-mist">
                {metric?.unit ?? "followers"} on {selected.name}
              </span>
            </p>
            {previous && (
              <p className="text-sm">
                <Delta from={previous.count} to={latest.count} />{" "}
                <span className="text-mist">since {prettyDay(previous.day)}</span>
              </p>
            )}
          </div>
          {metricsHere.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {metricsHere.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={metric?.id === m.id}
                  onClick={() => setMetricSel(m.id)}
                  className={`border px-2.5 py-1 text-xs font-semibold transition ${
                    metric?.id === m.id ? `border-brand bg-brand/10 ${m.tone}` : "border-edge text-mist hover:border-brand/60"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          <Sparkline stats={series} />
          <ul className="mt-3 divide-y divide-edge text-sm">
            {[...series].reverse().map((s, i, arr) => {
              const older = arr[i + 1];
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
                  <span className="w-28 shrink-0 text-mist">{prettyDay(s.day)}</span>
                  <span className="w-20 shrink-0 font-semibold">{exact(s.count)}</span>
                  <span className="w-16 shrink-0 text-xs">{older ? <Delta from={older.count} to={s.count} /> : <span className="text-mist">start</span>}</span>
                  {s.note && <span className="min-w-0 flex-1 truncate text-xs text-mist" title={s.note}>{s.note}</span>}
                  <form action={removeSocialStat} className="ml-auto">
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-xs text-mist transition hover:text-brand2" title="Remove this entry">
                      Remove
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {tracked.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-edge px-4 py-6 text-center text-sm text-mist">
          No counts logged yet. Start with where a channel is today — or dig out an old screenshot and log where it
          was a year ago.
        </p>
      )}

      <AddForm accounts={accounts} defaultPlatform={selected?.id ?? accounts[0]?.platform ?? PLATFORMS[0].id} />
    </div>
  );
}
