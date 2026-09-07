const test = require("node:test");
const assert = require("node:assert");

const {
  safeZone, toUtcStamp, toLocalInput, fromLocalInput,
  checkSchedule, describeSchedule, MIN_SCHEDULE_MINUTES, MAX_SCHEDULE_DAYS,
} = require(require("node:path").join(process.env.TEST_LIB, "schedule.js"));

test("a wall-clock time round-trips through UTC and back", () => {
  for (const zone of ["UTC", "America/Halifax", "Asia/Kolkata", "Pacific/Auckland"]) {
    const local = "2026-06-15T09:30";
    const utc = fromLocalInput(local, zone);
    assert.ok(utc, `no UTC for ${zone}`);
    assert.strictEqual(toLocalInput(utc, zone), local, `round trip failed for ${zone}`);
  }
});

test("half-hour and 45-minute offsets are handled, not rounded", () => {
  // Kolkata is UTC+05:30 and Kathmandu +05:45. Offset arithmetic that assumes
  // whole hours lands these on the wrong minute.
  assert.strictEqual(fromLocalInput("2026-06-15T09:30", "Asia/Kolkata"), "2026-06-15T04:00:00Z");
  assert.strictEqual(fromLocalInput("2026-06-15T09:45", "Asia/Kathmandu"), "2026-06-15T04:00:00Z");
});

test("times either side of a DST change convert at the right offset", () => {
  // New York moved to EDT on 8 March 2026. 01:30 is EST (-5), 03:30 is EDT (-4).
  assert.strictEqual(fromLocalInput("2026-03-08T01:30", "America/New_York"), "2026-03-08T06:30:00Z");
  assert.strictEqual(fromLocalInput("2026-03-08T03:30", "America/New_York"), "2026-03-08T07:30:00Z");
  // And back again in November: 01:30 on the repeated hour still resolves.
  const nov = fromLocalInput("2026-11-01T01:30", "America/New_York");
  assert.ok(nov && nov.endsWith("Z"), "ambiguous local time must still produce an instant");
});

test("an unknown zone falls back to UTC instead of throwing", () => {
  assert.strictEqual(safeZone("Mars/Olympus_Mons"), "UTC");
  assert.strictEqual(safeZone(""), "UTC");
  assert.strictEqual(safeZone("Europe/Berlin"), "Europe/Berlin");
  // The whole point of the fallback: this must not throw.
  assert.strictEqual(fromLocalInput("2026-06-15T09:30", "Nowhere/Real"), "2026-06-15T09:30:00Z");
});

test("stored stamps carry no milliseconds", () => {
  assert.strictEqual(toUtcStamp(new Date("2026-06-15T04:00:00.123Z")), "2026-06-15T04:00:00Z");
});

test("an empty request means send now", () => {
  assert.deepStrictEqual(checkSchedule("", "UTC"), { kind: "now" });
  assert.deepStrictEqual(checkSchedule("   ", "UTC"), { kind: "now" });
});

test("a time in the past means send now, not an error", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  assert.deepStrictEqual(checkSchedule("2026-06-15T09:00", "UTC", now), { kind: "now" });
});

test("a time inside the cron window means send now rather than late", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const tooClose = new Date(now.getTime() + (MIN_SCHEDULE_MINUTES - 1) * 60_000);
  const local = toLocalInput(tooClose.toISOString(), "UTC");
  assert.deepStrictEqual(checkSchedule(local, "UTC", now), { kind: "now" });
});

test("a real future time is accepted and returned as UTC", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  // Berlin is UTC+2 in June, so 15:00 there is 13:00Z - an hour past `now`,
  // which is the point: 14:00 Berlin would be 12:00Z exactly and correctly
  // reads as "send now".
  const out = checkSchedule("2026-06-15T15:00", "Europe/Berlin", now);
  assert.strictEqual(out.kind, "at");
  assert.strictEqual(out.utc, "2026-06-15T13:00:00Z");
});

test("beyond the horizon is refused", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const far = new Date(now.getTime() + (MAX_SCHEDULE_DAYS + 2) * 86_400_000);
  const out = checkSchedule(toLocalInput(far.toISOString(), "UTC"), "UTC", now);
  assert.strictEqual(out.kind, "error");
});

test("gibberish is refused rather than silently becoming the epoch", () => {
  assert.strictEqual(checkSchedule("not-a-date", "UTC").kind, "error");
  assert.strictEqual(checkSchedule("2026-13-45T99:99", "UTC").kind, "error");
  assert.strictEqual(fromLocalInput("2026-06-15", "UTC"), null);
});

test("the description names the zone it is showing", () => {
  const s = describeSchedule("2026-06-15T12:00:00Z", "Europe/Berlin");
  assert.match(s, /Europe\/Berlin/);
  assert.match(s, /14:00/);
});
