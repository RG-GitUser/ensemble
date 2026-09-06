const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const LIB = process.env.TEST_LIB;
const live = require(path.join(LIB, "live.js"));

/**
 * The live relay's app-side guarantees.
 *
 * The relay is a core feature, and the two things worth pinning here are the
 * ones a future edit would break silently: a destination URL carries the
 * creator's stream key, and the hook secret gates routes that are reachable
 * from the open internet. Neither failure is visible at a glance — a cleartext
 * push still works perfectly, and a sloppy secret compare still returns the
 * right answer.
 */

const ALL_KEYS = {
  twitchStreamKey: "twitch-key-abc",
  youtubeStreamKey: "youtube-key-def",
  facebookStreamKey: "facebook-key-ghi",
};

test("every push destination is rtmps, never cleartext rtmp", () => {
  const targets = live.pushTargets(ALL_KEYS);
  assert.equal(targets.length, 3, "all three configured keys should produce a target");

  for (const t of targets) {
    // The key is IN the URL. Anything that is not rtmps publishes the one
    // secret that lets a stranger broadcast to this creator's channel, to
    // every hop between the droplet and the platform.
    assert.ok(
      t.url.startsWith("rtmps://"),
      `${t.platform} pushes over ${t.url.split("://")[0]}://, which sends the stream key in the clear`
    );
    assert.ok(!t.url.startsWith("rtmp://"), `${t.platform} must not use cleartext rtmp`);
  }
});

test("each configured key produces exactly its own destination", () => {
  assert.deepEqual(live.pushTargets({}), [], "no keys, no pushes");

  const twitchOnly = live.pushTargets({ twitchStreamKey: "k" });
  assert.equal(twitchOnly.length, 1);
  assert.equal(twitchOnly[0].platform, "twitch");
  assert.ok(twitchOnly[0].url.includes("k"), "the saved key reaches the URL");

  // Instagram is deliberately unsupported — no official third-party RTMP
  // ingest. A target appearing for it means someone wired up a
  // reverse-engineered endpoint that will break mid-stream.
  const platforms = live.pushTargets(ALL_KEYS).map((t) => t.platform);
  assert.ok(!platforms.includes("instagram"), "instagram must stay unsupported");
});

test("an ingest key is only read from this relay's own app path", () => {
  assert.equal(live.pathIngestKey("live/abc123"), "abc123");
  assert.equal(live.pathIngestKey("other/abc123"), "", "a different app is not ours");
  assert.equal(live.pathIngestKey("live/abc/extra"), "", "nesting deeper is not ours");
  assert.equal(live.pathIngestKey("live/"), "", "an empty key is not a key");
  assert.equal(live.pathIngestKey("live"), "", "no key at all");
});

test("the hook secret compare rejects near-misses and does not early-exit", () => {
  const prev = process.env.LIVE_HOOK_SECRET;
  process.env.LIVE_HOOK_SECRET = "correct-horse-battery";

  const withHeader = (v) =>
    live.hookAuthorized(new Request("http://x", { headers: v === null ? {} : { "x-live-secret": v } }));

  try {
    assert.equal(withHeader("correct-horse-battery"), true);
    assert.equal(withHeader("correct-horse-batterX"), false, "last character differs");
    assert.equal(withHeader("Xorrect-horse-battery"), false, "first character differs");
    assert.equal(withHeader("correct-horse-batter"), false, "shorter");
    assert.equal(withHeader("correct-horse-batteryy"), false, "longer");
    assert.equal(withHeader(null), false, "absent header");
    assert.equal(withHeader(""), false, "empty header");

    // With no secret configured the routes must refuse everyone rather than
    // accept the empty string that an unconfigured box would also present.
    process.env.LIVE_HOOK_SECRET = "";
    assert.equal(withHeader(""), false, "unconfigured relay authorises nobody");
  } finally {
    if (prev === undefined) delete process.env.LIVE_HOOK_SECRET;
    else process.env.LIVE_HOOK_SECRET = prev;
  }
});
