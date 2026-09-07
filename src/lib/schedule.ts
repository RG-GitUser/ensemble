/**
 * Times, zones, and the shape of a schedule.
 *
 * Deliberately free of server-only imports: the composer needs the same
 * conversions to render a picker and to label a queued item, and a second
 * implementation on the client is how the two ends drift apart.
 *
 * Everything crossing the database boundary is UTC, always, in the form
 * 'YYYY-MM-DDTHH:MM:SSZ'. The creator's zone exists only at the edges - once
 * when they pick a time, once when it is shown back to them. Storing local
 * time would mean a row whose meaning changes when they travel, and a queue
 * that silently shifts by an hour twice a year.
 */

/** Furthest ahead anything may be scheduled. A year is already generous. */
export const MAX_SCHEDULE_DAYS = 365;

/**
 * Smallest gap between "now" and a chosen time.
 *
 * The runner wakes on a cron minute, so anything closer than this would be
 * accepted and then appear late, and "scheduled for 10:00, sent 10:00" is a
 * promise worth keeping literally. Below it the composer sends immediately
 * instead, which is what the creator meant.
 */
export const MIN_SCHEDULE_MINUTES = 2;

/** Zone names offered in Settings. Kept short and real rather than exhaustive. */
export const COMMON_ZONES = [
  "UTC",
  "America/St_Johns",
  "America/Halifax",
  "America/Toronto",
  "America/Chicago",
  "America/Denver",
  "America/Vancouver",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

/**
 * A zone we are willing to use. Anything unrecognised falls back to UTC rather
 * than throwing: a stored zone can outlive the tzdata that knew it, and an
 * account whose Settings page will not render is a worse outcome than one
 * whose times read in UTC until they pick again.
 */
export function safeZone(zone: string): string {
  const z = zone.trim();
  if (!z) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: z }).format(new Date());
    return z;
  } catch {
    return "UTC";
  }
}

/** UTC instant as the exact string the database stores. */
export function toUtcStamp(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * What `zone` reads on the clock at instant `d`, as datetime-local wants it.
 *
 * Formats the instant *in* the zone and reassembles the parts, which is the
 * only approach that stays correct across a DST boundary - offset arithmetic
 * silently produces a time that does not exist on the spring-forward day.
 */
export function toLocalInput(utcStamp: string, zone: string): string {
  const ms = Date.parse(utcStamp);
  if (Number.isNaN(ms)) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone(zone),
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // en-CA renders midnight as 24 rather than 00 in some runtimes.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * The reverse: a wall-clock 'YYYY-MM-DDTHH:MM' in `zone` to a UTC instant.
 *
 * There is no built-in for this direction. The reliable trick is to guess that
 * the local string is UTC, ask what that guess reads as in the zone, and
 * correct by the difference. Applied twice, because near a DST change the
 * first correction can land on the other side of the transition and needs
 * re-measuring at the new offset.
 *
 * Returns null for anything unparseable, so callers reject rather than
 * scheduling a post for the epoch.
 */
export function fromLocalInput(local: string, zone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const target = Date.parse(local + "Z");
  if (Number.isNaN(target)) return null;
  const tz = safeZone(zone);

  let guess = target;
  for (let i = 0; i < 2; i++) {
    const reads = Date.parse(toLocalInput(new Date(guess).toISOString(), tz) + "Z");
    if (Number.isNaN(reads)) return null;
    const drift = target - reads;
    if (drift === 0) break;
    guess += drift;
  }
  return toUtcStamp(new Date(guess));
}

export type ScheduleCheck =
  | { kind: "now" }
  | { kind: "at"; utc: string }
  | { kind: "error"; error: string };

/**
 * Validate a requested send time against the clock.
 *
 * Returns 'now' for an empty or near-immediate request, so the composer has
 * one code path: callers publish immediately on 'now' and queue on 'at'.
 */
export function checkSchedule(local: string, zone: string, now = new Date()): ScheduleCheck {
  if (!local.trim()) return { kind: "now" };

  const utc = fromLocalInput(local, zone);
  if (!utc) return { kind: "error", error: "That date and time didn't read as a real moment. Pick it again." };

  const when = Date.parse(utc);
  const minutesAway = (when - now.getTime()) / 60_000;

  if (minutesAway > MAX_SCHEDULE_DAYS * 24 * 60) {
    return { kind: "error", error: `Pick a time within the next ${MAX_SCHEDULE_DAYS} days.` };
  }
  // Already past, or so close the next cron pass would send it late anyway.
  if (minutesAway < MIN_SCHEDULE_MINUTES) return { kind: "now" };

  return { kind: "at", utc };
}

/** "Tue 9 Sep, 14:30 (Europe/Berlin)" - what a queued item shows. */
export function describeSchedule(utcStamp: string, zone: string): string {
  const ms = Date.parse(utcStamp);
  if (Number.isNaN(ms)) return "";
  const tz = safeZone(zone);
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(ms));
  return `${when} (${tz})`;
}
