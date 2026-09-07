const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const LIB = process.env.TEST_LIB;
const store = require(path.join(LIB, "db.js"));

/**
 * Scheduling's correctness guarantees.
 *
 * The one that matters most is the claim. A social post sent twice can be
 * deleted; a newsletter sent twice cannot be recalled from anybody's inbox.
 * Cron fires every minute and a fan-out can outlast a minute, so two passes
 * overlapping is the expected case, not bad luck.
 */

let seq = 0;
function freshSite(plan = "enterprise") {
  seq += 1;
  const user = store.createUser(`sch${seq}-${process.pid}@t.t`, "x", "T", "T");
  return store.createSite(user.id, `sch-${user.id}-${seq}`, plan, {});
}

/**
 * claimDueSocialPosts and claimDueNewsletters are global on purpose - the
 * runner wants every site's due work in one pass - and this suite shares one
 * database with every other test file. So every assertion about a claim is
 * scoped to the site under test; counting the raw result would make these
 * tests depend on what ran before them.
 */
const mine = (claims, site) => claims.filter((c) => c.siteId === site.id);

const PAST = "2020-01-01T00:00:00Z";
const FUTURE = "2099-01-01T00:00:00Z";
const NOW = "2026-06-15T12:00:00Z";

/* ---------------- posts ---------------- */

test("a post with no publish_at keeps the old immediate shape", () => {
  const s = freshSite();
  const id = store.createSocialPost(s.id, "hello", "", ["bluesky"]);
  const [post] = store.getSocialPosts(s.id);
  assert.equal(post.id, id);
  assert.equal(post.status, "sent");
  assert.equal(post.publishAt, "");
  assert.equal(store.getScheduledSocialPosts(s.id).length, 0, "an immediate post is not a queued one");
});

test("a scheduled post stays out of the sent history until it runs", () => {
  const s = freshSite();
  store.createSocialPost(s.id, "later", "", ["bluesky"], FUTURE);
  assert.equal(store.getSocialPosts(s.id).length, 0, "not sent, so not in history");
  const queued = store.getScheduledSocialPosts(s.id);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].status, "scheduled");
  assert.equal(queued[0].publishAt, FUTURE);
});

test("only posts whose time has come are claimed", () => {
  const s = freshSite();
  store.createSocialPost(s.id, "due", "", ["bluesky"], PAST);
  store.createSocialPost(s.id, "not yet", "", ["bluesky"], FUTURE);
  const claimed = mine(store.claimDueSocialPosts(NOW, 50), s);
  assert.equal(claimed.length, 1, "the future post must not be claimed");
  assert.equal(claimed[0].siteId, s.id, "the claim carries its owner");
});

test("a second pass cannot claim a post the first already took", () => {
  const s = freshSite();
  store.createSocialPost(s.id, "due", "", ["bluesky"], PAST);
  const first = mine(store.claimDueSocialPosts(NOW, 50), s);
  const second = mine(store.claimDueSocialPosts(NOW, 50), s);
  assert.equal(first.length, 1);
  assert.equal(second.length, 0, "double-claiming a post means posting it twice");
});

test("a post stranded by a killed run is swept back up later", () => {
  const s = freshSite();
  store.createSocialPost(s.id, "due", "", ["bluesky"], PAST);
  store.claimDueSocialPosts(NOW, 50); // claimed, then the process dies

  const soon = new Date(Date.parse(NOW) + 60_000).toISOString();
  assert.equal(mine(store.claimDueSocialPosts(soon, 50), s).length, 0,
    "still within the window: a slow send must not be stolen mid-flight");

  const later = new Date(Date.parse(NOW) + (store.CLAIM_STALE_MINUTES + 1) * 60_000).toISOString();
  assert.equal(mine(store.claimDueSocialPosts(later, 50), s).length, 1,
    "past the window it must be recovered");
});

test("finishing a post moves it into the history", () => {
  const s = freshSite();
  const id = store.createSocialPost(s.id, "due", "", ["bluesky"], PAST);
  store.claimDueSocialPosts(NOW, 50);
  store.finishSocialPost(id);
  assert.equal(store.getScheduledSocialPosts(s.id).length, 0);
  assert.equal(store.getSocialPosts(s.id).length, 1);
});

test("cancelling a queued post removes it from the queue and the history", () => {
  const s = freshSite();
  const id = store.createSocialPost(s.id, "nope", "", ["bluesky"], FUTURE);
  assert.equal(store.cancelScheduledSocialPost(s.id, id), true);
  assert.equal(store.getScheduledSocialPosts(s.id).length, 0);
  assert.equal(store.getSocialPosts(s.id).length, 0, "a cancelled post was never sent");
  assert.equal(mine(store.claimDueSocialPosts(FUTURE, 50), s).length, 0, "and must never be claimed");
});

test("a claimed post can no longer be cancelled", () => {
  const s = freshSite();
  const id = store.createSocialPost(s.id, "in flight", "", ["bluesky"], PAST);
  store.claimDueSocialPosts(NOW, 50);
  assert.equal(store.cancelScheduledSocialPost(s.id, id), false,
    "the send may already be out; saying it was cancelled would be a lie");
});

test("one site cannot cancel another's post", () => {
  const ours = freshSite();
  const theirs = freshSite();
  const id = store.createSocialPost(theirs.id, "theirs", "", ["bluesky"], FUTURE);
  assert.equal(store.cancelScheduledSocialPost(ours.id, id), false);
  assert.equal(store.getScheduledSocialPosts(theirs.id).length, 1);
});

/* ---------------- newsletters ---------------- */

test("a scheduled newsletter is claimed once and only once", () => {
  const s = freshSite();
  store.createScheduledNewsletter(s.id, "Subject", "Body", PAST);
  const first = mine(store.claimDueNewsletters(NOW, 50), s);
  const second = mine(store.claimDueNewsletters(NOW, 50), s);
  assert.equal(first.length, 1);
  assert.equal(first[0].subject, "Subject");
  assert.equal(second.length, 0, "a newsletter sent twice cannot be taken back");
});

test("a newsletter not yet due is left alone", () => {
  const s = freshSite();
  store.createScheduledNewsletter(s.id, "Later", "Body", FUTURE);
  assert.equal(mine(store.claimDueNewsletters(NOW, 50), s).length, 0);
  assert.equal(store.getScheduledNewsletters(s.id).length, 1);
});

test("a failed newsletter records why, and stays out of the queue", () => {
  const s = freshSite();
  const id = store.createScheduledNewsletter(s.id, "S", "B", PAST);
  store.claimDueNewsletters(NOW, 50);
  store.finishScheduledNewsletter(id, "failed", "The mail service rejected the send.");
  assert.equal(store.getScheduledNewsletters(s.id).length, 0);
  const [outcome] = store.getRecentNewsletterOutcomes(s.id);
  assert.equal(outcome.status, "failed");
  assert.match(outcome.detail, /rejected/);
});

test("cancelling a queued newsletter keeps it from ever being claimed", () => {
  const s = freshSite();
  const id = store.createScheduledNewsletter(s.id, "S", "B", PAST);
  assert.equal(store.cancelScheduledNewsletter(s.id, id), true);
  assert.equal(mine(store.claimDueNewsletters(NOW, 50), s).length, 0);
});

test("one site cannot cancel another's newsletter", () => {
  const ours = freshSite();
  const theirs = freshSite();
  const id = store.createScheduledNewsletter(theirs.id, "S", "B", FUTURE);
  assert.equal(store.cancelScheduledNewsletter(ours.id, id), false);
  assert.equal(store.getScheduledNewsletters(theirs.id).length, 1);
});

test("deleting an account takes its queue with it", () => {
  const s = freshSite();
  store.createScheduledNewsletter(s.id, "S", "B", FUTURE);
  store.createSocialPost(s.id, "queued", "", ["bluesky"], FUTURE);
  store.deleteUserAccount(s.userId);
  // The ON DELETE CASCADE has to reach both new tables, or a closed account
  // keeps posting and mailing on a schedule nobody can now cancel.
  assert.equal(store.getScheduledNewsletters(s.id).length, 0);
  assert.equal(store.getScheduledSocialPosts(s.id).length, 0);
});
