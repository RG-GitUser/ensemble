const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const LIB = process.env.TEST_LIB;
const store = require(path.join(LIB, "db.js"));

/**
 * A second connection to the same file, for assertions about what is STORED
 * rather than what the mappers hand back. Kept out of db.ts deliberately: a
 * raw-blob accessor exported purely for tests is production API nobody wants.
 */
const Database = require("better-sqlite3");
let rawDb;
function raw() {
  // Opened lazily so db.ts has created and migrated the file first.
  if (!rawDb) {
    rawDb = new Database(path.join(process.cwd(), "data", "app.db"));
    // Same courtesy db.ts extends: wait rather than fail if the other
    // connection is mid-write.
    rawDb.pragma("busy_timeout = 5000");
  }
  return rawDb;
}
const storedConfig = (id) => raw().prepare("SELECT config FROM sites WHERE id = ?").get(id).config;
const corruptConfig = (id) => raw().prepare("UPDATE sites SET config = '{not json' WHERE id = ?").run(id);

/**
 * The data layer's correctness guarantees.
 *
 * Each of these is a behaviour that used to be wrong in a way nothing would
 * have surfaced — a lost config write, a subscriber who kept receiving mail
 * after unsubscribing, a "delete my data" that left the data. They fail loudly
 * here instead.
 */

let seq = 0;
function freshSite(plan = "basic") {
  seq += 1;
  const user = store.createUser(`u${seq}-${process.pid}@t.t`, "x", "T", "T");
  return store.createSite(user.id, `s-${user.id}-${seq}`, plan, {});
}

/* ---------------- DATA-3: one subscriber, one row ---------------- */

test("the same address cannot subscribe twice to one site", () => {
  const s = freshSite();
  store.addLead(s.id, "dupe@example.com");
  store.addLead(s.id, "dupe@example.com");
  store.addLead(s.id, "DUPE@example.com"); // case must not create a second row
  assert.equal(store.getLeads(s.id).length, 1);
});

test("unsubscribing stops the mail, not just one copy of it", () => {
  const s = freshSite();
  store.addLead(s.id, "reader@example.com");
  const [lead] = store.getLeads(s.id);
  assert.equal(store.unsubscribeLeadByToken(lead.unsubToken), true);
  assert.equal(store.getActiveLeads(s.id).length, 0, "an unsubscribed address must not be in the send list");
});

test("unsubscribing twice is success, not an error", () => {
  const s = freshSite();
  store.addLead(s.id, "reader@example.com");
  const [lead] = store.getLeads(s.id);
  store.unsubscribeLeadByToken(lead.unsubToken);
  assert.equal(store.unsubscribeLeadByToken(lead.unsubToken), true);
});

test("an unknown unsubscribe token is refused", () => {
  assert.equal(store.unsubscribeLeadByToken("0".repeat(32)), false);
});

test("re-subscribing does not silently resurrect an opt-out", () => {
  const s = freshSite();
  store.addLead(s.id, "gone@example.com");
  const [lead] = store.getLeads(s.id);
  store.unsubscribeLeadByToken(lead.unsubToken);
  store.addLead(s.id, "gone@example.com");
  assert.equal(store.getActiveLeads(s.id).length, 0, "an INSERT must never undo an unsubscribe");
});

/* ---------------- DATA-7 / DATA-4: config writes ---------------- */

test("a plan-only update does not write the default palette into config", () => {
  const s = freshSite();
  store.updateSite(s.id, { plan: "pro" });
  assert.equal(storedConfig(s.id), "{}", "updateSite must not persist defaults it merely read");
});

test("updateSite writes only the columns it was given", () => {
  const s = freshSite();
  store.updateSite(s.id, { config: { tagline: "hello" } });
  store.updateSite(s.id, { published: true });
  const after = store.getSiteById(s.id);
  assert.equal(after.config.tagline, "hello");
  assert.equal(after.published, true);
});

test("patchSiteConfig merges without disturbing other keys", () => {
  const s = freshSite();
  store.patchSiteConfig(s.id, { tagline: "one", chatroomEnabled: true });
  store.patchSiteConfig(s.id, { liveNow: true });
  const after = store.getSiteById(s.id);
  assert.equal(after.config.tagline, "one");
  assert.equal(after.config.chatroomEnabled, true);
  assert.equal(after.config.liveNow, true);
});

test("patchSiteConfig removes a key set to undefined", () => {
  const s = freshSite();
  store.patchSiteConfig(s.id, { bgImage: "/api/uploads/x.png" });
  store.patchSiteConfig(s.id, { bgImage: undefined });
  assert.equal(store.getSiteById(s.id).config.bgImage, undefined);
});

/* ---------------- DATA-5: "delete my data" deletes the data ---------------- */

test("deleteSiteData clears the three tables it used to leave behind", () => {
  const s = freshSite();
  store.addLead(s.id, "a@example.com");
  store.recordFollowerCount(s.id, "tiktok", "2026-01-01", 400000, "manual");
  store.recordNewsletterPost(s.id, "Subject", "Body", 1);
  store.replaceSiteContent(s.id, [{ selector: "h1", kind: "text", original: "Hi", position: 1 }]);

  assert.ok(store.getFollowerHistory(s.id).length > 0, "precondition");
  assert.ok(store.getNewsletterPosts(s.id).length > 0, "precondition");
  assert.ok(store.countSiteContent(s.id) > 0, "precondition");

  store.deleteSiteData(s.id);

  assert.equal(store.getFollowerHistory(s.id).length, 0, "follower history is what the chart renders from");
  assert.equal(store.getNewsletterPosts(s.id).length, 0, "newsletter bodies must go");
  assert.equal(store.countSiteContent(s.id), 0, "scraped site content must go");
  assert.equal(store.getLeads(s.id).length, 0);
});

/* ---------------- DATA-10: disconnecting takes its history with it ---------------- */

test("disconnecting a platform removes its follower history", () => {
  const s = freshSite();
  store.recordFollowerCount(s.id, "tiktok", "2026-01-01", 400000, "manual");
  store.recordFollowerCount(s.id, "youtube", "2026-01-01", 1000, "manual");
  store.deleteSocialAccount(s.id, "tiktok");
  const platforms = store.getFollowerHistory(s.id).map((r) => r.platform);
  assert.ok(!platforms.includes("tiktok"), "a disconnected platform must stop inflating the total");
  assert.ok(platforms.includes("youtube"));
});

/* ---------------- API-5: the referrer column is bounded ---------------- */

test("a hostile referrer cannot mint unbounded rows", () => {
  const s = freshSite();
  for (let i = 0; i < 200; i++) store.recordPageView(s.id, `evil-${i}.example.com`);
  const rows = store.getTopReferrers(s.id, 1000);
  assert.ok(rows.length <= 51, `expected the per-day cap to hold, got ${rows.length} distinct referrers`);
  assert.ok(rows.some((r) => r.referrer === "other"), "overflow must fold into one bucket");
});

test("a referrer that is not a hostname is not stored as one", () => {
  const s = freshSite();
  store.recordPageView(s.id, "<script>alert(1)</script>");
  store.recordPageView(s.id, "x".repeat(500));
  const rows = store.getTopReferrers(s.id, 100).map((r) => r.referrer);
  assert.ok(!rows.some((r) => r.includes("<")), "non-hostnames must not get their own row");
  assert.ok(!rows.some((r) => r.length > 253));
});

test("direct traffic keeps its own bucket", () => {
  const s = freshSite();
  store.recordPageView(s.id, "");
  assert.ok(store.getTopReferrers(s.id, 10).some((r) => r.referrer === ""));
});

/* ---------------- DATA-8: things are pruned ---------------- */

test("pruneExpired removes expired sessions and spent tokens", () => {
  const s = freshSite();
  const userId = store.getSiteById(s.id).userId;
  store.createSession("expired-token-" + s.id, userId, Date.now() - 1000);
  store.createAuthToken("dead-" + s.id, userId, "password_reset", Date.now() - 1000);

  const removed = store.pruneExpired();
  assert.ok(removed.sessions >= 1, "expired sessions must be swept");
  assert.ok(removed.tokens >= 1, "expired tokens must be swept");
  assert.equal(store.getSessionUser("expired-token-" + s.id), null);
});

/* ---------------- DATA-9: one bad row must not take down a tenant ---------------- */

test("a corrupt config blob falls back to defaults instead of throwing", () => {
  const s = freshSite();
  corruptConfig(s.id);
  const after = store.getSiteById(s.id);
  assert.ok(after, "getSiteById must not throw on a corrupt blob");
  assert.equal(typeof after.config.themeColor, "string", "defaults must still be present");
});

/* ---------------- DATA-11 / DATA-17 ---------------- */

test("sections come back in a stable order", () => {
  const s = freshSite();
  const a = store.addSection(s.id, "hero", {});
  const b = store.addSection(s.id, "about", {});
  // Force a position collision, which the schema allows.
  store.reorderSections(s.id, [a.id, b.id]);
  const first = store.getSections(s.id).map((x) => x.id);
  const second = store.getSections(s.id).map((x) => x.id);
  assert.deepEqual(first, second, "the same query must not reorder itself between calls");
});

test("getDailyViews(id, 30) covers 30 days, not 31", () => {
  const s = freshSite();
  store.recordPageView(s.id, "");
  const rows = store.getDailyViews(s.id, 1);
  assert.ok(rows.length <= 1, "a 1-day window must not return 2 days");
});

/* ---------------- DOM-1 / OPS-18 ---------------- */

test("a verified claim covers its www variant", () => {
  const s = freshSite();
  store.claimCustomDomain(s.id, "example-claim.com", "tok");
  store.markDomainVerified(s.id);
  assert.equal(store.domainTaken("example-claim.com", undefined), true);
  assert.equal(
    store.domainTaken("www.example-claim.com", undefined),
    true,
    "resolveDomain serves the www flip, so domainTaken must agree about it"
  );
  assert.equal(store.domainTaken("example-claim.com", s.id), false, "the owner is not blocked by their own claim");
});

test("verification can be revoked", () => {
  const s = freshSite();
  store.claimCustomDomain(s.id, "lapsed-claim.com", "tok");
  store.markDomainVerified(s.id);
  store.clearDomainVerification(s.id);
  assert.equal(store.domainTaken("lapsed-claim.com", undefined), false, "a lapsed claim must not lock the name forever");
});

/* ---------------- content snapshots (API-1 undo) ---------------- */

test("a content report snapshots the creator's edits first", () => {
  const s = freshSite();
  store.replaceSiteContent(s.id, [{ selector: "h1", kind: "text", original: "Original", position: 1 }]);
  const [item] = store.getSiteContent(s.id);
  store.setContentEdit(s.id, item.id, "My edit");

  // A hostile report replaces the whole inventory.
  store.replaceSiteContent(s.id, [{ selector: "p", kind: "text", original: "Junk", position: 1 }]);
  const snapshots = store.getContentSnapshots(s.id);
  assert.ok(snapshots.length > 0, "the edits must be recoverable after a report wipes them");
  assert.equal(snapshots[0].editedCount, 1);
});

test("a snapshot restores edits onto the current inventory", () => {
  const s = freshSite();
  store.replaceSiteContent(s.id, [{ selector: "h1", kind: "text", original: "Original", position: 1 }]);
  const [item] = store.getSiteContent(s.id);
  store.setContentEdit(s.id, item.id, "My edit");
  store.replaceSiteContent(s.id, [{ selector: "p", kind: "text", original: "Junk", position: 1 }]);
  // The real page comes back on the next honest report.
  store.replaceSiteContent(s.id, [{ selector: "h1", kind: "text", original: "Original", position: 1 }]);

  const [snapshot] = store.getContentSnapshots(s.id);
  const restored = store.restoreContentSnapshot(s.id, snapshot.id);
  assert.equal(restored, 1);
  assert.equal(store.getEditedContent(s.id)[0].edited, "My edit");
});

/* ---------------- AUTH-3 ---------------- */

test("a password reset kills every other pending link", () => {
  const s = freshSite();
  const userId = store.getSiteById(s.id).userId;
  store.createAuthToken(`recover-${s.id}`, userId, "recover_login", Date.now() + 60_000);
  store.createAuthToken(`reset-${s.id}`, userId, "password_reset", Date.now() + 60_000);

  assert.equal(store.consumePasswordReset(`reset-${s.id}`, "newhash"), true);
  assert.equal(
    store.getAuthToken(`recover-${s.id}`, "recover_login"),
    null,
    "an outstanding recovery link must not survive a password reset"
  );
});

test("removing a recovery address kills its pending link", () => {
  const s = freshSite();
  const userId = store.getSiteById(s.id).userId;
  store.createAuthToken(`rec2-${s.id}`, userId, "recover_login", Date.now() + 60_000);
  store.clearBackupEmail(userId);
  assert.equal(store.getAuthToken(`rec2-${s.id}`, "recover_login"), null);
});

test("recovery is refused once the backup address is gone", () => {
  const s = freshSite();
  const userId = store.getSiteById(s.id).userId;
  store.createAuthToken(`rec3-${s.id}`, userId, "recover_login", Date.now() + 60_000, "");
  // The token exists, but the address behind it was never verified.
  assert.equal(
    store.consumeLoginRecovery(`rec3-${s.id}`, "attacker@example.com", "hash"),
    false,
    "a link must not work after the address it belongs to is removed"
  );
});

/* ---------------- AUTH-6 ---------------- */

test("the locked demo account is recognisable as unreachable", () => {
  const demo = store.getUserByEmail("demo@ensemble.app");
  if (!demo) return; // demo seeding is skipped in some environments
  assert.equal(store.isLockedAccount(demo.passwordHash), true);
});
