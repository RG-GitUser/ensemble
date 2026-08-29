import type { FollowerSnapshot } from "./types";

/**
 * Follower history maths.
 *
 * Readings are sparse — a creator logs their numbers when they think of it,
 * not every day — so almost everything here is about answering "what was the
 * count on this date" from readings taken on other dates. The rule throughout
 * is carry-forward: a count holds until a newer reading replaces it, and a
 * platform contributes nothing before its first reading (it isn't zero
 * followers, it's simply unknown).
 */

export interface FollowerPoint {
  day: string;
  total: number;
  byPlatform: Record<string, number>;
}

/** YYYY-MM-DD, matching how page_views days are cut elsewhere. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return isoDay(new Date());
}

/** A YYYY-MM-DD string, or "" if it isn't one. Guards anything user-supplied. */
export function cleanDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || isoDay(d) !== value ? "" : value;
}

/** The last `n` days ending today, oldest first. */
export function lastDays(n: number, end = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(isoDay(d));
  }
  return out;
}

/**
 * Turn sparse readings into a value for every day requested.
 *
 * Walks the readings once alongside the day list, so this stays linear however
 * long the history gets.
 */
export function buildSeries(snapshots: FollowerSnapshot[], days: string[]): FollowerPoint[] {
  const sorted = [...snapshots].sort((a, b) => a.day.localeCompare(b.day));
  const current: Record<string, number> = {};
  let i = 0;

  return days.map((day) => {
    while (i < sorted.length && sorted[i].day <= day) {
      current[sorted[i].platform] = sorted[i].count;
      i++;
    }
    const byPlatform = { ...current };
    return { day, byPlatform, total: Object.values(byPlatform).reduce((s, n) => s + n, 0) };
  });
}

/** Platforms this site has ever recorded, most-followed first. */
export function platformsSeen(snapshots: FollowerSnapshot[]): string[] {
  const latest = new Map<string, { day: string; count: number }>();
  for (const s of snapshots) {
    const seen = latest.get(s.platform);
    if (!seen || s.day >= seen.day) latest.set(s.platform, { day: s.day, count: s.count });
  }
  return [...latest.entries()].sort((a, b) => b[1].count - a[1].count).map(([p]) => p);
}

/**
 * The reading immediately before `day` for a platform — what the count moved
 * *from*. Returns null when this is the first reading there is, since "no
 * previous reading" and "no change" are different things and the UI shows them
 * differently.
 */
export function previousReading(
  snapshots: FollowerSnapshot[],
  platform: string,
  day: string
): FollowerSnapshot | null {
  const before = snapshots
    .filter((s) => s.platform === platform && s.day < day)
    .sort((a, b) => a.day.localeCompare(b.day));
  return before.length ? before[before.length - 1] : null;
}

/** "3/14" — the compact axis label the other analytics charts use. */
export function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** "24 Mar 2026" — for prose, where an ambiguous 3/4 would not do. */
export function longDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** 12400 -> "12.4k". Keeps big follower counts from crowding a tile. */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}
