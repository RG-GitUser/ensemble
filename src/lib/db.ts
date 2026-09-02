import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomBytes, scryptSync } from "crypto";
import type {
  ChatMessage,
  Connection,
  CustomDomain,
  ContentItem,
  DailyViews,
  FollowerReading,
  FollowerSnapshot,
  Lead,
  NewsletterPost,
  QuoteRequest,
  ReferrerViews,
  Section,
  Site,
  SocialAccount,
  SocialAccountAuth,
  SocialPost,
  SocialStat,
  SupportTicket,
  User,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function createDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "app.db"));
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '',
      expires_at INTEGER NOT NULL,
      used_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL DEFAULT 'basic',
      published INTEGER NOT NULL DEFAULT 0,
      config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      position INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS quote_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      email TEXT NOT NULL,
      website_url TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      -- One-click unsubscribe needs a secret per address: the link in every
      -- email carries it, so nobody can unsubscribe someone else by guessing.
      unsub_token TEXT NOT NULL DEFAULT '',
      unsubscribed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- One row per newsletter actually sent — the Audience tab's history.
    CREATE TABLE IF NOT EXISTS newsletter_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      recipients INTEGER NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
      -- Posted by the site owner from the dashboard — the room shows a badge.
      is_creator INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      reply TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS page_views (
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      referrer TEXT NOT NULL DEFAULT '',
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (site_id, day, referrer)
    );
    CREATE TABLE IF NOT EXISTS custom_domains (
      site_id INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
      hostname TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT,
      -- Proof of ownership. The creator publishes verify_token in a TXT record
      -- on the domain; verified_at is stamped once we read it back. Until then
      -- the claim is worth nothing: it does not resolve, does not earn a
      -- certificate, and does not stop anyone else claiming the same name.
      verify_token TEXT NOT NULL DEFAULT '',
      verified_at TEXT
    );
    CREATE TABLE IF NOT EXISTS connections (
      site_id INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_scraped TEXT,
      last_seen TEXT,
      seen_host TEXT NOT NULL DEFAULT '',
      needs_report INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS site_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      selector TEXT NOT NULL,
      kind TEXT NOT NULL,
      original TEXT NOT NULL,
      edited TEXT,
      position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS social_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      handle TEXT NOT NULL,
      auth_kind TEXT NOT NULL DEFAULT 'handle',
      secret TEXT NOT NULL DEFAULT '',
      refresh_token TEXT NOT NULL DEFAULT '',
      expires_at TEXT,
      external_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (site_id, platform)
    );
    CREATE TABLE IF NOT EXISTS social_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      media_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_prefs (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tutorials_enabled INTEGER NOT NULL DEFAULT 1,
      -- Comma-separated ids of tours already seen. A list rather than a row
      -- per tour: it is only ever read and written whole.
      tours_seen TEXT NOT NULL DEFAULT '',
      -- Has this person been offered the walkthrough yet? Distinct from
      -- tours_seen, which fills in as they read individual bubbles.
      welcomed INTEGER NOT NULL DEFAULT 0,
      -- Has the finished setup checklist been dismissed? Only ever set once
      -- every checkpoint is done, so this can hide a completed list and
      -- never an outstanding one.
      setup_dismissed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS social_post_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      detail TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS social_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      -- Which number this is: followers, likes, views, shares, subscribers.
      metric TEXT NOT NULL DEFAULT 'followers',
      -- The date the count was true, not the date it was typed in: growth
      -- tracking is exactly the case where people backfill old milestones.
      day TEXT NOT NULL,
      count INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (site_id, platform, metric, day)
    );
    -- One dated follower reading per platform. Shaped like page_views: the
    -- day is the key, not a timestamp, because "how many followers did I have
    -- on the 3rd" is a question about a date. Re-recording a day corrects that
    -- day's figure instead of stacking a second reading, so a typo is fixed by
    -- entering it again.
    CREATE TABLE IF NOT EXISTS follower_counts (
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      PRIMARY KEY (site_id, platform, day)
    );
  `);

  // Publisher-pipeline columns arrived after the social tables shipped.
  // Recovery address. Verified separately from being set, because an address
  // nobody has proved they can read is no way back into an account.
  const userCols = new Set((db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!userCols.has("backup_email")) db.exec("ALTER TABLE users ADD COLUMN backup_email TEXT NOT NULL DEFAULT ''");
  if (!userCols.has("backup_verified_at")) db.exec("ALTER TABLE users ADD COLUMN backup_verified_at INTEGER NOT NULL DEFAULT 0");
  // password_resets was folded into auth_tokens before either shipped, so
  // there is no deployment holding rows worth carrying across. The tokens it
  // held live 45 minutes anyway.
  db.exec("DROP TABLE IF EXISTS password_resets");

  const saCols = new Set((db.prepare("PRAGMA table_info(social_accounts)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!saCols.has("auth_kind")) db.exec("ALTER TABLE social_accounts ADD COLUMN auth_kind TEXT NOT NULL DEFAULT 'handle'");
  if (!saCols.has("secret")) db.exec("ALTER TABLE social_accounts ADD COLUMN secret TEXT NOT NULL DEFAULT ''");
  if (!saCols.has("refresh_token")) db.exec("ALTER TABLE social_accounts ADD COLUMN refresh_token TEXT NOT NULL DEFAULT ''");
  if (!saCols.has("expires_at")) db.exec("ALTER TABLE social_accounts ADD COLUMN expires_at TEXT");
  if (!saCols.has("external_id")) db.exec("ALTER TABLE social_accounts ADD COLUMN external_id TEXT NOT NULL DEFAULT ''");
  // social_stats gained a metric, and its old UNIQUE(site_id, platform, day)
  // would then allow only one metric per platform per day. SQLite cannot alter
  // a constraint, so the table is rebuilt once. Every existing row carries in
  // as a follower reading, which is what all of them were.
  const ssCols = new Set((db.prepare("PRAGMA table_info(social_stats)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!ssCols.has("metric")) {
    db.exec(`
      CREATE TABLE social_stats_rebuilt (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        metric TEXT NOT NULL DEFAULT 'followers',
        day TEXT NOT NULL,
        count INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (site_id, platform, metric, day)
      );
      INSERT INTO social_stats_rebuilt (id, site_id, platform, metric, day, count, note, created_at)
        SELECT id, site_id, platform, 'followers', day, count, note, created_at FROM social_stats;
      DROP TABLE social_stats;
      ALTER TABLE social_stats_rebuilt RENAME TO social_stats;
    `);
  }

  const tCols = new Set((db.prepare("PRAGMA table_info(social_post_targets)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!tCols.has("detail")) db.exec("ALTER TABLE social_post_targets ADD COLUMN detail TEXT NOT NULL DEFAULT ''");
  // Domain ownership verification arrived after custom_domains shipped.
  // Existing rows are marked verified: they were added under the old rules,
  // where saving a hostname was all there was, and silently unpublishing
  // somebody's live domain to enforce a new rule would be the wrong trade.
  const domCols = new Set((db.prepare("PRAGMA table_info(custom_domains)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!domCols.has("verify_token")) {
    db.exec("ALTER TABLE custom_domains ADD COLUMN verify_token TEXT NOT NULL DEFAULT ''");
  }
  if (!domCols.has("verified_at")) {
    db.exec(`
      ALTER TABLE custom_domains ADD COLUMN verified_at TEXT;
      UPDATE custom_domains SET verified_at = datetime('now') WHERE verified_at IS NULL;
    `);
  }
  // The welcome prompt arrived after user_prefs shipped, so everyone who
  // already had an account is marked as welcomed on the way in. They have
  // been round the dashboard already, and greeting them with "Welcome" would
  // be plainly wrong. Only accounts created from here on meet it.
  //
  // The backfill has to insert as well as update: a user who never touched
  // the Tutorials switch has no prefs row at all, and getUserPrefs reads a
  // missing row as brand new.
  const prefCols = new Set((db.prepare("PRAGMA table_info(user_prefs)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!prefCols.has("setup_dismissed")) {
    db.exec("ALTER TABLE user_prefs ADD COLUMN setup_dismissed INTEGER NOT NULL DEFAULT 0");
  }
  if (!prefCols.has("welcomed")) {
    db.exec(`
      ALTER TABLE user_prefs ADD COLUMN welcomed INTEGER NOT NULL DEFAULT 0;
      INSERT INTO user_prefs (user_id, tutorials_enabled, tours_seen, welcomed)
        SELECT id, 1, '', 1 FROM users WHERE id NOT IN (SELECT user_id FROM user_prefs);
      UPDATE user_prefs SET welcomed = 1;
    `);
  }
  // Snippet-reported content discovery replaced the server-side URL scan.
  const connCols = new Set((db.prepare("PRAGMA table_info(connections)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!connCols.has("needs_report")) db.exec("ALTER TABLE connections ADD COLUMN needs_report INTEGER NOT NULL DEFAULT 1");

  const qCols = new Set((db.prepare("PRAGMA table_info(quote_requests)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!qCols.has("platform")) db.exec("ALTER TABLE quote_requests ADD COLUMN platform TEXT NOT NULL DEFAULT ''");
  if (!qCols.has("access_method")) db.exec("ALTER TABLE quote_requests ADD COLUMN access_method TEXT NOT NULL DEFAULT ''");
  if (!qCols.has("file_name")) db.exec("ALTER TABLE quote_requests ADD COLUMN file_name TEXT NOT NULL DEFAULT ''");

  // Embed tokens arrived after the first schema shipped — migrate in place.
  const siteCols = db.prepare("PRAGMA table_info(sites)").all() as Array<{ name: string }>;
  if (!siteCols.some((c) => c.name === "embed_token")) {
    db.exec("ALTER TABLE sites ADD COLUMN embed_token TEXT");
  }
  const untokened = db.prepare("SELECT id FROM sites WHERE embed_token IS NULL OR embed_token = ''").all() as Array<{
    id: number;
  }>;
  const setToken = db.prepare("UPDATE sites SET embed_token = ? WHERE id = ?");
  for (const row of untokened) setToken.run(newEmbedToken(), row.id);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_embed_token ON sites(embed_token)");

  // Unsubscribe tokens arrived after leads shipped. Every address gets one,
  // because the link goes into every email sent from here on.
  const leadCols = new Set((db.prepare("PRAGMA table_info(leads)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!leadCols.has("unsub_token")) db.exec("ALTER TABLE leads ADD COLUMN unsub_token TEXT NOT NULL DEFAULT ''");
  if (!leadCols.has("unsubscribed_at")) db.exec("ALTER TABLE leads ADD COLUMN unsubscribed_at TEXT");
  const untokenedLeads = db.prepare("SELECT id FROM leads WHERE unsub_token = ''").all() as Array<{ id: number }>;
  const setLeadToken = db.prepare("UPDATE leads SET unsub_token = ? WHERE id = ?");
  for (const row of untokenedLeads) setLeadToken.run(randomBytes(16).toString("hex"), row.id);

  // The creator badge arrived after chat shipped — messages posted from the
  // dashboard carry it, so the room can tell the host from the guests.
  const chatCols = new Set((db.prepare("PRAGMA table_info(chat_messages)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!chatCols.has("is_creator")) db.exec("ALTER TABLE chat_messages ADD COLUMN is_creator INTEGER NOT NULL DEFAULT 0");

  // Live-relay ingest keys arrived after the first schema shipped. Same shape
  // as embed tokens: every site gets one, because handing them out lazily
  // would mean a null-check at every read for no benefit.
  if (!siteCols.some((c) => c.name === "ingest_key")) {
    db.exec("ALTER TABLE sites ADD COLUMN ingest_key TEXT");
  }
  const unkeyed = db.prepare("SELECT id FROM sites WHERE ingest_key IS NULL OR ingest_key = ''").all() as Array<{
    id: number;
  }>;
  const setIngest = db.prepare("UPDATE sites SET ingest_key = ? WHERE id = ?");
  for (const row of unkeyed) setIngest.run(newIngestKey(), row.id);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_ingest_key ON sites(ingest_key)");

  // Stripe billing columns arrived after the first schema shipped.
  if (!siteCols.some((c) => c.name === "stripe_customer_id")) {
    db.exec("ALTER TABLE sites ADD COLUMN stripe_customer_id TEXT NOT NULL DEFAULT ''");
  }
  if (!siteCols.some((c) => c.name === "stripe_subscription_id")) {
    db.exec("ALTER TABLE sites ADD COLUMN stripe_subscription_id TEXT NOT NULL DEFAULT ''");
  }
  if (!siteCols.some((c) => c.name === "billing_status")) {
    db.exec("ALTER TABLE sites ADD COLUMN billing_status TEXT NOT NULL DEFAULT ''");
  }
  // Unix seconds of the newest applied Stripe event (webhook ordering guard).
  if (!siteCols.some((c) => c.name === "billing_event_at")) {
    db.exec("ALTER TABLE sites ADD COLUMN billing_event_at INTEGER NOT NULL DEFAULT 0");
  }
  // Per-section visual theme (design themes shipped after sections).
  const sectionCols = db.prepare("PRAGMA table_info(sections)").all() as Array<{ name: string }>;
  if (!sectionCols.some((c) => c.name === "theme")) {
    db.exec("ALTER TABLE sections ADD COLUMN theme TEXT NOT NULL DEFAULT ''");
  }
  // Per-section text alignment. Empty means the shipped default, which is
  // centred, so every existing section keeps the look it already had.
  if (!sectionCols.some((c) => c.name === "align")) {
    db.exec("ALTER TABLE sections ADD COLUMN align TEXT NOT NULL DEFAULT ''");
  }
  // Where the section's buttons sit. Kept apart from `align` on purpose: a
  // centred button under a left-aligned paragraph is a normal thing to want.
  if (!sectionCols.some((c) => c.name === "button_align")) {
    db.exec("ALTER TABLE sections ADD COLUMN button_align TEXT NOT NULL DEFAULT ''");
  }
  // The demo/hq showcase sites are exempt from billing on databases seeded
  // before the billing columns existed.
  db.exec("UPDATE sites SET billing_status = 'active' WHERE slug IN ('demo', 'hq') AND billing_status = ''");

  return db;
}

function newEmbedToken(): string {
  return randomBytes(12).toString("hex");
}

/**
 * Longer than an embed token on purpose: an embed token only reads public
 * page content, but whoever holds an ingest key can broadcast video to the
 * creator's channels.
 */
function newIngestKey(): string {
  return randomBytes(24).toString("hex");
}

// A syntactically valid salt:hash that no real password can produce, so the
// demo account can never be logged into.
const DEMO_LOCKED_HASH = "0".repeat(32) + ":" + "0".repeat(128);

/** Seed the public example page at /demo (idempotent). */
function seedDemo(d: Database.Database): void {
  if (d.prepare("SELECT id FROM sites WHERE slug = 'demo'").get()) return;

  let userId: number;
  const existing = d.prepare("SELECT id FROM users WHERE email = ?").get("demo@ensemble.app") as
    | { id: number }
    | undefined;
  if (existing) {
    userId = existing.id;
  } else {
    const info = d
      .prepare("INSERT INTO users (email, password_hash, name, business_name) VALUES (?, ?, ?, ?)")
      .run("demo@ensemble.app", DEMO_LOCKED_HASH, "Nova Rae", "Nova Rae");
    userId = Number(info.lastInsertRowid);
  }

  const config = JSON.stringify({
    themeColor: "#8b5cf6",
    tagline: "This is a live example page — yours takes about 10 minutes.",
    newsletterEnabled: true,
    chatroomEnabled: true,
  });
  const siteInfo = d
    .prepare(
      "INSERT INTO sites (user_id, slug, plan, published, config, embed_token, billing_status) VALUES (?, 'demo', 'enterprise', 1, ?, ?, 'active')"
    )
    .run(userId, config, newEmbedToken());
  const siteId = Number(siteInfo.lastInsertRowid);

  const sections: Array<[string, Record<string, string>]> = [
    [
      "hero",
      {
        heading: "Nova Rae",
        subheading:
          "Synthpop, vlogs and 2am livestreams. This page is the front door to everything I make — and everything you can't get anywhere else.",
        ctaLabel: "Hear the new single",
        ctaUrl: "#content",
      },
    ],
    [
      "about",
      {
        heading: "About me",
        body: "I'm Nova — I write songs in my bedroom studio and film everything that goes wrong along the way. 1.2M of you follow the chaos on socials; this page is where the inner circle hangs out. Early demos, tour vlogs and merch drops land here first.",
        imageUrl: "",
      },
    ],
    [
      "bonus",
      {
        heading: "Bonus content",
        items:
          "Unreleased demo: 'Glass Hearts' | Rough cut from last week's session | https://example.com\nTour vlog, ep. 3 | The night everything broke in Denver | https://example.com\nEarly access: next merch drop | 48 hours before everyone else | https://example.com",
      },
    ],
    [
      "links",
      {
        heading: "Find me everywhere",
        items:
          "YouTube | https://youtube.com\nSpotify | https://open.spotify.com\nInstagram | https://instagram.com\nTikTok | https://tiktok.com",
      },
    ],
    [
      "merch",
      {
        heading: "The merch stand",
        items:
          "Glass Hearts Tee | $28 | | https://example.com\nSigned Tour Poster | $15 | | https://example.com\nNova Hoodie | $48 | | https://example.com",
      },
    ],
    [
      "newsletter",
      {
        heading: "Join the inner circle",
        body: "One email a week — new songs, presale codes and stories I don't post anywhere else.",
        buttonLabel: "Count me in",
      },
    ],
    [
      "chatroom",
      {
        heading: "The clubhouse",
        body: "Members hang out here between drops. Be kind, share demos, spoil nothing.",
      },
    ],
    [
      "contact",
      {
        heading: "Say hi",
        email: "team@novarae.example",
        body: "For bookings, brand collabs and press.",
      },
    ],
  ];
  const insert = d.prepare("INSERT INTO sections (site_id, type, position, content) VALUES (?, ?, ?, ?)");
  sections.forEach(([type, content], i) => insert.run(siteId, type, i + 1, JSON.stringify(content)));
  // Show off container themes on the example page.
  const setTheme = d.prepare("UPDATE sections SET theme = ? WHERE site_id = ? AND type = ?");
  setTheme.run("sunset", siteId, "merch");
  setTheme.run("aurora", siteId, "newsletter");
  setTheme.run("ocean", siteId, "chatroom");
}

/** Give the demo chatroom a few messages so it looks alive (idempotent). */
function seedDemoChat(d: Database.Database): void {
  const site = d.prepare("SELECT id FROM sites WHERE slug = 'demo'").get() as { id: number } | undefined;
  if (!site) return;
  const existing = d.prepare("SELECT COUNT(*) AS c FROM chat_messages WHERE site_id = ?").get(site.id) as { c: number };
  if (existing.c > 0) return;
  const insert = d.prepare("INSERT INTO chat_messages (site_id, author, body) VALUES (?, ?, ?)");
  insert.run(site.id, "mika", "first!");
  insert.run(site.id, "jae", "the glass hearts demo is stuck in my head");
  insert.run(site.id, "Nova Rae", "welcome to the clubhouse — new drop friday");
}

/**
 * The password the admin account is seeded with.
 *
 * "admin1234" is fine on a laptop and indefensible on a public host, and this
 * source is public, so in production the fallback must not be a string anyone
 * can look up. Without ADMIN_PASSWORD we mint a random one and print it once,
 * which keeps /admin reachable on a fresh box without publishing the way in.
 * Rotate it deliberately with scripts/set-admin-password.mjs.
 */
function seedPassword(): string {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV !== "production") return "admin1234";
  const generated = randomBytes(18).toString("base64url");
  console.warn(`[ensemble] No ADMIN_PASSWORD set. Admin seeded with: ${generated}`);
  console.warn("[ensemble] Save that now, then rotate it with scripts/set-admin-password.mjs.");
  return generated;
}

/**
 * Seed the admin account so /admin is reachable out of the box (idempotent).
 * Email matches ADMIN_EMAIL in auth.ts; the password comes from seedPassword
 * above, which only falls back to a known string outside production.
 */
function seedAdmin(d: Database.Database): void {
  const email = (process.env.ADMIN_EMAIL || "rileyg0035@gmail.com").toLowerCase();
  const existing = d.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;
  if (existing) {
    // The admin account seeded as "Ensemble HQ", which then shows in the
    // dashboard sidebar and on the seeded page. The brand is just Ensemble —
    // rename in place, matched exactly so nothing a person chose is touched.
    d.prepare("UPDATE users SET business_name = 'Ensemble' WHERE id = ? AND business_name = 'Ensemble HQ'").run(
      existing.id
    );
    d.prepare(
      "UPDATE sections SET content = replace(content, 'Ensemble HQ', 'Ensemble') WHERE site_id IN (SELECT id FROM sites WHERE user_id = ?) AND content LIKE '%Ensemble HQ%'"
    ).run(existing.id);
    return;
  }

  const password = seedPassword();
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  const info = d
    .prepare("INSERT INTO users (email, password_hash, name, business_name) VALUES (?, ?, ?, ?)")
    .run(email, `${salt}:${hash}`, "Site Admin", "Ensemble");
  const userId = Number(info.lastInsertRowid);

  const config = JSON.stringify({ themeColor: "#8b5cf6", tagline: "" });
  const siteInfo = d
    .prepare(
      "INSERT INTO sites (user_id, slug, plan, published, config, embed_token, billing_status) VALUES (?, 'hq', 'enterprise', 0, ?, ?, 'active')"
    )
    .run(userId, config, newEmbedToken());
  const siteId = Number(siteInfo.lastInsertRowid);
  d.prepare("INSERT INTO sections (site_id, type, position, content) VALUES (?, 'hero', 1, ?)").run(
    siteId,
    JSON.stringify({
      heading: "Ensemble",
      subheading: "Admin test page.",
      ctaLabel: "",
      ctaUrl: "",
    })
  );
}

// Lazily opened and cached across dev hot-reloads, so importing this module
// (e.g. during build-time page analysis) doesn't touch the database file.
const g = globalThis as unknown as { __appDb?: Database.Database; __appDbSeeded?: boolean };
function db(): Database.Database {
  const d = (g.__appDb ??= createDb());
  if (!g.__appDbSeeded) {
    seedDemo(d);
    seedDemoChat(d);
    seedAdmin(d);
    g.__appDbSeeded = true;
  }
  return d;
}

/* ---------- row mappers ---------- */

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  business_name: string;
  created_at: string;
  backup_email: string;
  backup_verified_at: number;
}
interface SiteRow {
  id: number;
  user_id: number;
  slug: string;
  plan: string;
  published: number;
  config: string;
  embed_token: string | null;
  ingest_key: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_status: string | null;
  billing_event_at: number | null;
  created_at: string;
}
interface SectionRow {
  id: number;
  site_id: number;
  type: string;
  position: number;
  content: string;
  theme: string | null;
  align: string | null;
  button_align: string | null;
}
interface QuoteRow {
  id: number;
  user_id: number;
  name: string;
  business_name: string;
  email: string;
  website_url: string;
  details: string;
  platform: string;
  access_method: string;
  file_name: string;
  status: string;
  created_at: string;
}
interface LeadRow {
  id: number;
  site_id: number;
  email: string;
  unsub_token: string;
  unsubscribed_at: string | null;
  created_at: string;
}

function toUser(r: UserRow): User {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    businessName: r.business_name,
    createdAt: r.created_at,
    backupEmail: r.backup_email ?? "",
    backupVerifiedAt: r.backup_verified_at ?? 0,
  };
}
/**
 * What every site's config falls back to before its own stored values are laid
 * over the top. Exported because the setup checklist has to tell "the creator
 * picked this" from "this is just what ships" — and comparing against these is
 * the only way to know.
 */
export const SITE_CONFIG_DEFAULTS = {
  themeColor: "#8b5cf6",
  bgColor: "#0a0812",
  cardColor: "rgba(255,255,255,0.05)",
  tagline: "",
};

function toSite(r: SiteRow): Site {
  return {
    id: r.id,
    userId: r.user_id,
    slug: r.slug,
    plan: (r.plan as Site["plan"]) || "basic",
    published: r.published === 1,
    config: {
      ...SITE_CONFIG_DEFAULTS,
      ...JSON.parse(r.config || "{}"),
    },
    embedToken: r.embed_token ?? "",
    ingestKey: r.ingest_key ?? "",
    stripeCustomerId: r.stripe_customer_id ?? "",
    stripeSubscriptionId: r.stripe_subscription_id ?? "",
    billingStatus: r.billing_status ?? "",
    billingEventAt: r.billing_event_at ?? 0,
    createdAt: r.created_at,
  };
}
function toSection(r: SectionRow): Section {
  return {
    id: r.id,
    siteId: r.site_id,
    type: r.type,
    position: r.position,
    content: JSON.parse(r.content || "{}"),
    theme: r.theme ?? "",
    align: r.align ?? "",
    buttonAlign: r.button_align ?? "",
  };
}
function toQuote(r: QuoteRow): QuoteRequest {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    businessName: r.business_name,
    email: r.email,
    websiteUrl: r.website_url,
    details: r.details,
    platform: r.platform ?? "",
    accessMethod: r.access_method ?? "",
    fileName: r.file_name ?? "",
    status: r.status as QuoteRequest["status"],
    createdAt: r.created_at,
  };
}
function toLead(r: LeadRow): Lead {
  return {
    id: r.id,
    siteId: r.site_id,
    email: r.email,
    unsubToken: r.unsub_token,
    unsubscribedAt: r.unsubscribed_at ?? null,
    createdAt: r.created_at,
  };
}

/* ---------- users & sessions ---------- */

export function createUser(email: string, passwordHash: string, name: string, businessName: string): User {
  const info = db()
    .prepare("INSERT INTO users (email, password_hash, name, business_name) VALUES (?, ?, ?, ?)")
    .run(email.toLowerCase(), passwordHash, name, businessName);
  return getUserById(Number(info.lastInsertRowid))!;
}

export function getUserByEmail(email: string): (User & { passwordHash: string }) | null {
  const r = db().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRow | undefined;
  return r ? { ...toUser(r), passwordHash: r.password_hash } : null;
}

export function getUserById(id: number): User | null {
  const r = db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return r ? toUser(r) : null;
}

/** Profile edits — identity only; email and password are changed elsewhere. */
export function updateUser(id: number, fields: { name?: string; businessName?: string }): void {
  const user = getUserById(id);
  if (!user) return;
  db()
    .prepare("UPDATE users SET name = ?, business_name = ? WHERE id = ?")
    .run(fields.name ?? user.name, fields.businessName ?? user.businessName, id);
}

/**
 * Wipe everything a site has collected or accumulated — analytics, subscriber
 * emails, chat, connected social accounts with their credentials, the posting
 * history and the growth log. The account, the page and its design survive:
 * this is "delete my data", not "delete me", and the two are offered apart so
 * nobody nukes their page wanting only a clean slate.
 */
export function deleteSiteData(siteId: number): void {
  const d = db();
  const tx = d.transaction(() => {
    d.prepare("DELETE FROM page_views WHERE site_id = ?").run(siteId);
    d.prepare("DELETE FROM leads WHERE site_id = ?").run(siteId);
    d.prepare("DELETE FROM chat_messages WHERE site_id = ?").run(siteId);
    // Targets go with their posts via ON DELETE CASCADE.
    d.prepare("DELETE FROM social_posts WHERE site_id = ?").run(siteId);
    d.prepare("DELETE FROM social_accounts WHERE site_id = ?").run(siteId);
    d.prepare("DELETE FROM social_stats WHERE site_id = ?").run(siteId);
  });
  tx();
}

/**
 * The whole account, gone. Every child row — session, site, sections, domain
 * claim, collected data, credentials, tickets, prefs — follows through the
 * ON DELETE CASCADE chain, which is the point of having built it that way.
 */
export function deleteUserAccount(userId: number): void {
  db().prepare("DELETE FROM users WHERE id = ?").run(userId);
}

export function createSession(token: string, userId: number, expiresAt: number): void {
  db().prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
}

export function getSessionUser(token: string): User | null {
  const r = db()
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, Date.now()) as UserRow | undefined;
  return r ? toUser(r) : null;
}

export function deleteSession(token: string): void {
  db().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/* ---------- auth tokens ---------- */

/**
 * One table for every emailed link that proves control of a mailbox: password
 * resets, backup-address verification, and recovery of a forgotten login
 * address. They differ only in what spending one does, so they share the
 * issue / look-up / consume machinery and are told apart by `purpose`.
 *
 * `payload` carries whatever the purpose needs — the address being verified,
 * for instance — so a pending change lives with the token rather than being
 * written to the account before anyone has proved anything.
 */
export type AuthTokenPurpose = "password_reset" | "verify_backup" | "recover_login";

/**
 * Issue a link, replacing any earlier one of the same purpose for that account.
 *
 * A second request therefore invalidates the first: a link forwarded or left in
 * an old inbox stops working the moment the real owner asks again.
 */
export function createAuthToken(
  token: string,
  userId: number,
  purpose: AuthTokenPurpose,
  expiresAt: number,
  payload = ""
): void {
  const d = db();
  d.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?").run(userId, purpose);
  d.prepare("INSERT INTO auth_tokens (token, user_id, purpose, payload, expires_at) VALUES (?, ?, ?, ?, ?)").run(
    token,
    userId,
    purpose,
    payload,
    expiresAt
  );
}

/** The account and payload behind a live, unused token — null once spent or expired. */
export function getAuthToken(token: string, purpose: AuthTokenPurpose): { user: User; payload: string } | null {
  const r = db()
    .prepare(
      `SELECT u.*, t.payload AS token_payload FROM auth_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token = ? AND t.purpose = ? AND t.used_at = 0 AND t.expires_at > ?`
    )
    .get(token, purpose, Date.now()) as (UserRow & { token_payload: string }) | undefined;
  return r ? { user: toUser(r), payload: r.token_payload } : null;
}

/**
 * Spend a token and apply its effect in one transaction.
 *
 * Everything that consumes a link goes through here so that checking and
 * spending can never be separated — a link submitted twice does its work once
 * and reports the second attempt as expired. `apply` runs only after the token
 * is confirmed live and marked used.
 */
function consumeAuthToken(
  token: string,
  purpose: AuthTokenPurpose,
  apply: (d: ReturnType<typeof db>, userId: number, payload: string) => void
): boolean {
  const d = db();
  const run = d.transaction(() => {
    const row = d
      .prepare("SELECT user_id, payload FROM auth_tokens WHERE token = ? AND purpose = ? AND used_at = 0 AND expires_at > ?")
      .get(token, purpose, Date.now()) as { user_id: number; payload: string } | undefined;
    if (!row) return false;
    d.prepare("UPDATE auth_tokens SET used_at = ? WHERE token = ?").run(Date.now(), token);
    apply(d, row.user_id, row.payload);
    return true;
  });
  return run();
}

/**
 * Set a new password and sign every other session out.
 *
 * Dropping the sessions is the point: someone resetting because a password
 * leaked needs whoever else is holding it thrown out too.
 */
export function consumePasswordReset(token: string, passwordHash: string): boolean {
  return consumeAuthToken(token, "password_reset", (d, userId) => {
    d.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
    d.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  });
}

/** Promote the pending address in the token to the account's verified backup. */
export function consumeBackupVerification(token: string): boolean {
  return consumeAuthToken(token, "verify_backup", (d, userId, payload) => {
    d.prepare("UPDATE users SET backup_email = ?, backup_verified_at = ? WHERE id = ?").run(payload, Date.now(), userId);
  });
}

/**
 * Recovery: set the address the account logs in with, and a new password.
 *
 * Both at once because someone who has lost track of their login address has
 * almost certainly lost the password with it, and they have already proved
 * they control the recovery mailbox. Every session goes, so anyone signed in
 * on the old address is turned out.
 */
export function consumeLoginRecovery(token: string, newEmail: string, passwordHash: string): boolean {
  return consumeAuthToken(token, "recover_login", (d, userId) => {
    d.prepare("UPDATE users SET email = ?, password_hash = ? WHERE id = ?").run(newEmail, passwordHash, userId);
    d.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  });
}

/** The single account holding this address as a verified backup, if any. */
export function getUserByBackupEmail(email: string): User | null {
  const r = db()
    .prepare("SELECT * FROM users WHERE backup_email = ? AND backup_verified_at > 0")
    .get(email) as UserRow | undefined;
  return r ? toUser(r) : null;
}

/** Clear a recovery address without needing a round trip through email. */
export function clearBackupEmail(userId: number): void {
  db().prepare("UPDATE users SET backup_email = '', backup_verified_at = 0 WHERE id = ?").run(userId);
}

/* ---------- sites ---------- */

export function createSite(userId: number, slug: string, plan: string, config: object): Site {
  const info = db()
    .prepare("INSERT INTO sites (user_id, slug, plan, config, embed_token) VALUES (?, ?, ?, ?, ?)")
    .run(userId, slug, plan, JSON.stringify(config), newEmbedToken());
  return getSiteById(Number(info.lastInsertRowid))!;
}

export function getSiteById(id: number): Site | null {
  const r = db().prepare("SELECT * FROM sites WHERE id = ?").get(id) as SiteRow | undefined;
  return r ? toSite(r) : null;
}

export function getSiteByUser(userId: number): Site | null {
  const r = db().prepare("SELECT * FROM sites WHERE user_id = ?").get(userId) as SiteRow | undefined;
  return r ? toSite(r) : null;
}

export function getSiteBySlug(slug: string): Site | null {
  const r = db().prepare("SELECT * FROM sites WHERE slug = ?").get(slug) as SiteRow | undefined;
  return r ? toSite(r) : null;
}

export function getSiteByToken(token: string): Site | null {
  if (!token) return null;
  const r = db().prepare("SELECT * FROM sites WHERE embed_token = ?").get(token) as SiteRow | undefined;
  return r ? toSite(r) : null;
}

/** Issue a fresh embed token, invalidating any snippets using the old one. */
export function regenerateEmbedToken(siteId: number): void {
  db().prepare("UPDATE sites SET embed_token = ? WHERE id = ?").run(newEmbedToken(), siteId);
}

/** The site allowed to broadcast with this ingest key, or null. */
export function getSiteByIngestKey(key: string): Site | null {
  if (!key) return null;
  const r = db().prepare("SELECT * FROM sites WHERE ingest_key = ?").get(key) as SiteRow | undefined;
  return r ? toSite(r) : null;
}

/** Issue a fresh ingest key — the old one stops opening the relay immediately. */
export function regenerateIngestKey(siteId: number): void {
  db().prepare("UPDATE sites SET ingest_key = ? WHERE id = ?").run(newIngestKey(), siteId);
}

export function slugTaken(slug: string, excludeSiteId?: number): boolean {
  const r = db().prepare("SELECT id FROM sites WHERE slug = ?").get(slug) as { id: number } | undefined;
  return !!r && r.id !== excludeSiteId;
}

export function updateSite(id: number, fields: { slug?: string; plan?: string; published?: boolean; config?: object }): void {
  const site = getSiteById(id);
  if (!site) return;
  db().prepare("UPDATE sites SET slug = ?, plan = ?, published = ?, config = ? WHERE id = ?").run(
    fields.slug ?? site.slug,
    fields.plan ?? site.plan,
    fields.published === undefined ? (site.published ? 1 : 0) : fields.published ? 1 : 0,
    JSON.stringify(fields.config ?? site.config),
    id
  );
}

export function setSiteBilling(
  id: number,
  fields: { stripeCustomerId?: string; stripeSubscriptionId?: string; billingStatus?: string; billingEventAt?: number }
): void {
  const site = getSiteById(id);
  if (!site) return;
  db()
    .prepare(
      "UPDATE sites SET stripe_customer_id = ?, stripe_subscription_id = ?, billing_status = ?, billing_event_at = ? WHERE id = ?"
    )
    .run(
      fields.stripeCustomerId ?? site.stripeCustomerId,
      fields.stripeSubscriptionId ?? site.stripeSubscriptionId,
      fields.billingStatus ?? site.billingStatus,
      fields.billingEventAt ?? site.billingEventAt,
      id
    );
}

export function getSiteByStripeSubscription(subscriptionId: string): Site | null {
  if (!subscriptionId) return null;
  const r = db().prepare("SELECT * FROM sites WHERE stripe_subscription_id = ?").get(subscriptionId) as
    | SiteRow
    | undefined;
  return r ? toSite(r) : null;
}

export function getSiteByStripeCustomer(customerId: string): Site | null {
  if (!customerId) return null;
  const r = db().prepare("SELECT * FROM sites WHERE stripe_customer_id = ?").get(customerId) as SiteRow | undefined;
  return r ? toSite(r) : null;
}

/* ---------- per-person preferences ---------- */

export interface UserPrefs {
  tutorialsEnabled: boolean;
  /** Tour ids this person has already been shown. */
  toursSeen: string[];
  /** Whether the first-sign-in walkthrough offer has been answered. */
  welcomed: boolean;
  /** Whether the finished setup checklist has been put away. */
  setupDismissed: boolean;
}

/** Preferences for a user, with the shipped defaults when they have none. */
export function getUserPrefs(userId: number): UserPrefs {
  const r = db().prepare("SELECT * FROM user_prefs WHERE user_id = ?").get(userId) as
    | { tutorials_enabled: number; tours_seen: string; welcomed: number; setup_dismissed: number }
    | undefined;
  // No row at all is the truest "brand new": nothing has been answered yet.
  if (!r) return { tutorialsEnabled: true, toursSeen: [], welcomed: false, setupDismissed: false };
  return {
    tutorialsEnabled: r.tutorials_enabled === 1,
    toursSeen: r.tours_seen ? r.tours_seen.split(",").filter(Boolean) : [],
    welcomed: r.welcomed === 1,
    setupDismissed: r.setup_dismissed === 1,
  };
}

function writePrefs(userId: number, p: UserPrefs): void {
  db()
    .prepare(
      `INSERT INTO user_prefs (user_id, tutorials_enabled, tours_seen, welcomed, setup_dismissed)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET tutorials_enabled = excluded.tutorials_enabled,
         tours_seen = excluded.tours_seen, welcomed = excluded.welcomed,
         setup_dismissed = excluded.setup_dismissed`
    )
    .run(
      userId,
      p.tutorialsEnabled ? 1 : 0,
      p.toursSeen.join(","),
      p.welcomed ? 1 : 0,
      p.setupDismissed ? 1 : 0
    );
}

/** Switching tutorials back on replays them, so the seen list is cleared. */
export function setTutorialsEnabled(userId: number, enabled: boolean): void {
  const p = getUserPrefs(userId);
  // welcomed is carried through: turning tips off later doesn't make someone
  // new again, so the welcome prompt must not come back.
  writePrefs(userId, { ...p, tutorialsEnabled: enabled, toursSeen: enabled ? [] : p.toursSeen });
}

/**
 * Answer the welcome prompt.
 *
 * Taking the walkthrough leaves the bubbles on and replays them from the top;
 * declining turns them off, so someone who said "I'll look around myself"
 * isn't then followed around by tips. Settings turns them back on.
 */
export function completeWelcome(userId: number, takeTour: boolean): void {
  const p = getUserPrefs(userId);
  writePrefs(userId, {
    ...p,
    tutorialsEnabled: takeTour,
    toursSeen: takeTour ? [] : p.toursSeen,
    welcomed: true,
  });
}

/**
 * Put the finished setup checklist away.
 *
 * The dashboard only offers this once every checkpoint is done, and it puts
 * the card back the moment one stops being done. So the flag can hide a
 * completed list and can never hide outstanding work.
 */
export function dismissSetup(userId: number): void {
  writePrefs(userId, { ...getUserPrefs(userId), setupDismissed: true });
}

export function markTourSeen(userId: number, tourId: string): void {
  const p = getUserPrefs(userId);
  if (p.toursSeen.includes(tourId)) return;
  writePrefs(userId, { ...p, toursSeen: [...p.toursSeen, tourId] });
}

/* ---------- sections ---------- */

export function getSections(siteId: number): Section[] {
  const rows = db().prepare("SELECT * FROM sections WHERE site_id = ? ORDER BY position").all(siteId) as SectionRow[];
  return rows.map(toSection);
}

export function getSection(id: number): Section | null {
  const r = db().prepare("SELECT * FROM sections WHERE id = ?").get(id) as SectionRow | undefined;
  return r ? toSection(r) : null;
}

export function countSections(siteId: number): number {
  const r = db().prepare("SELECT COUNT(*) AS c FROM sections WHERE site_id = ?").get(siteId) as { c: number };
  return r.c;
}

export function addSection(siteId: number, type: string, content: Record<string, string>): Section {
  const pos = db().prepare("SELECT COALESCE(MAX(position), 0) AS p FROM sections WHERE site_id = ?").get(siteId) as {
    p: number;
  };
  const info = db()
    .prepare("INSERT INTO sections (site_id, type, position, content) VALUES (?, ?, ?, ?)")
    .run(siteId, type, pos.p + 1, JSON.stringify(content));
  return getSection(Number(info.lastInsertRowid))!;
}

export function setSectionTheme(id: number, theme: string): void {
  db().prepare("UPDATE sections SET theme = ? WHERE id = ?").run(theme, id);
}

export function setSectionAlign(id: number, align: string): void {
  db().prepare("UPDATE sections SET align = ? WHERE id = ?").run(align, id);
}

export function setSectionButtonAlign(id: number, align: string): void {
  db().prepare("UPDATE sections SET button_align = ? WHERE id = ?").run(align, id);
}

export function updateSectionContent(id: number, content: Record<string, string>): void {
  db().prepare("UPDATE sections SET content = ? WHERE id = ?").run(JSON.stringify(content), id);
}

/**
 * Merge a few keys into a section's content, leaving the rest alone.
 *
 * The style rail writes markers and sizes without knowing anything about the
 * creator's words, so it must not hand back a whole content object — that is
 * how an editor open in another tab loses a heading.
 */
export function patchSectionContent(id: number, patch: Record<string, string>): void {
  const row = db().prepare("SELECT content FROM sections WHERE id = ?").get(id) as { content: string } | undefined;
  if (!row) return;
  let current: Record<string, string> = {};
  try {
    current = JSON.parse(row.content) as Record<string, string>;
  } catch {}
  db().prepare("UPDATE sections SET content = ? WHERE id = ?").run(JSON.stringify({ ...current, ...patch }), id);
}

export function deleteSection(id: number): void {
  db().prepare("DELETE FROM sections WHERE id = ?").run(id);
}

export function moveSection(id: number, dir: "up" | "down"): void {
  const s = getSection(id);
  if (!s) return;
  const neighbor = db()
    .prepare(
      dir === "up"
        ? "SELECT * FROM sections WHERE site_id = ? AND position < ? ORDER BY position DESC LIMIT 1"
        : "SELECT * FROM sections WHERE site_id = ? AND position > ? ORDER BY position ASC LIMIT 1"
    )
    .get(s.siteId, s.position) as SectionRow | undefined;
  if (!neighbor) return;
  const swap = db().prepare("UPDATE sections SET position = ? WHERE id = ?");
  const tx = db().transaction(() => {
    swap.run(neighbor.position, s.id);
    swap.run(s.position, neighbor.id);
  });
  tx();
}

/**
 * Rewrites the whole ordering in one transaction — what drag-and-drop needs,
 * since a drag can move an item past many neighbours at once and pairwise
 * swaps would need N round trips. `orderedIds` must be exactly this site's
 * section ids; the caller checks that, and the `site_id` guard in the UPDATE
 * is the backstop so a foreign id can never be repositioned.
 */
export function reorderSections(siteId: number, orderedIds: number[]): void {
  const update = db().prepare("UPDATE sections SET position = ? WHERE id = ? AND site_id = ?");
  const tx = db().transaction(() => {
    orderedIds.forEach((id, i) => update.run(i + 1, id, siteId));
  });
  tx();
}

/* ---------- quotes ---------- */

export function createQuoteRequest(
  userId: number,
  name: string,
  businessName: string,
  email: string,
  websiteUrl: string,
  details: string,
  platform: string,
  accessMethod: string
): QuoteRequest {
  const info = db()
    .prepare(
      `INSERT INTO quote_requests (user_id, name, business_name, email, website_url, details, platform, access_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, name, businessName, email, websiteUrl, details, platform, accessMethod);
  const r = db().prepare("SELECT * FROM quote_requests WHERE id = ?").get(Number(info.lastInsertRowid)) as QuoteRow;
  return toQuote(r);
}

export function getQuoteById(id: number): QuoteRequest | null {
  const r = db().prepare("SELECT * FROM quote_requests WHERE id = ?").get(id) as QuoteRow | undefined;
  return r ? toQuote(r) : null;
}

export function setQuoteFileName(id: number, fileName: string): void {
  db().prepare("UPDATE quote_requests SET file_name = ? WHERE id = ?").run(fileName, id);
}

export function getQuoteByUser(userId: number): QuoteRequest | null {
  const r = db()
    .prepare("SELECT * FROM quote_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1")
    .get(userId) as QuoteRow | undefined;
  return r ? toQuote(r) : null;
}

export function getAllQuotes(): QuoteRequest[] {
  const rows = db().prepare("SELECT * FROM quote_requests ORDER BY id DESC").all() as QuoteRow[];
  return rows.map(toQuote);
}

export function updateQuoteStatus(id: number, status: string): void {
  db().prepare("UPDATE quote_requests SET status = ? WHERE id = ?").run(status, id);
}

/* ---------- leads ---------- */

export function addLead(siteId: number, email: string): void {
  db()
    .prepare("INSERT INTO leads (site_id, email, unsub_token) VALUES (?, ?, ?)")
    .run(siteId, email, randomBytes(16).toString("hex"));
}

/** The list a newsletter actually goes to — everyone who hasn't opted out. */
export function getActiveLeads(siteId: number): Lead[] {
  const rows = db()
    .prepare("SELECT * FROM leads WHERE site_id = ? AND unsubscribed_at IS NULL ORDER BY id DESC")
    .all(siteId) as LeadRow[];
  return rows.map(toLead);
}

/**
 * Honour an unsubscribe link. Keyed by the secret token alone — the link in
 * the email is the proof. Idempotent, and returns whether the token matched
 * anything so the page can be honest about it.
 */
export function unsubscribeLeadByToken(token: string): boolean {
  const info = db()
    .prepare("UPDATE leads SET unsubscribed_at = datetime('now') WHERE unsub_token = ? AND unsubscribed_at IS NULL")
    .run(token);
  if (info.changes > 0) return true;
  // Already unsubscribed still counts as success — clicking twice shouldn't scold.
  return !!db().prepare("SELECT id FROM leads WHERE unsub_token = ?").get(token);
}

export function getLeads(siteId: number): Lead[] {
  const rows = db().prepare("SELECT * FROM leads WHERE site_id = ? ORDER BY id DESC").all(siteId) as LeadRow[];
  return rows.map(toLead);
}

export function countLeads(siteId: number): number {
  const r = db().prepare("SELECT COUNT(*) AS c FROM leads WHERE site_id = ?").get(siteId) as { c: number };
  return r.c;
}

export function getLead(id: number): Lead | null {
  const r = db().prepare("SELECT * FROM leads WHERE id = ?").get(id) as LeadRow | undefined;
  return r ? toLead(r) : null;
}

export function deleteLead(id: number): void {
  db().prepare("DELETE FROM leads WHERE id = ?").run(id);
}

/* ---------- newsletter broadcasts ---------- */

interface NewsletterPostRow {
  id: number;
  site_id: number;
  subject: string;
  body: string;
  recipients: number;
  sent_at: string;
}

function toNewsletterPost(r: NewsletterPostRow): NewsletterPost {
  return { id: r.id, siteId: r.site_id, subject: r.subject, body: r.body, recipients: r.recipients, sentAt: r.sent_at };
}

export function recordNewsletterPost(siteId: number, subject: string, body: string, recipients: number): void {
  db()
    .prepare("INSERT INTO newsletter_posts (site_id, subject, body, recipients) VALUES (?, ?, ?, ?)")
    .run(siteId, subject, body, recipients);
}

export function getNewsletterPosts(siteId: number, limit = 20): NewsletterPost[] {
  const rows = db()
    .prepare("SELECT * FROM newsletter_posts WHERE site_id = ? ORDER BY id DESC LIMIT ?")
    .all(siteId, limit) as NewsletterPostRow[];
  return rows.map(toNewsletterPost);
}

/* ---------- chat messages ---------- */

interface ChatRow {
  id: number;
  site_id: number;
  author: string;
  body: string;
  is_creator: number;
  created_at: string;
}

function toChatMessage(r: ChatRow): ChatMessage {
  return { id: r.id, siteId: r.site_id, author: r.author, body: r.body, isCreator: !!r.is_creator, createdAt: r.created_at };
}

/** Latest `limit` messages, oldest first (chat display order). */
export function getChatMessages(siteId: number, limit = 50): ChatMessage[] {
  const rows = db()
    .prepare("SELECT * FROM chat_messages WHERE site_id = ? ORDER BY id DESC LIMIT ?")
    .all(siteId, limit) as ChatRow[];
  return rows.map(toChatMessage).reverse();
}

export function getChatMessage(id: number): ChatMessage | null {
  const r = db().prepare("SELECT * FROM chat_messages WHERE id = ?").get(id) as ChatRow | undefined;
  return r ? toChatMessage(r) : null;
}

export function addChatMessage(siteId: number, author: string, body: string, isCreator = false): ChatMessage {
  const info = db()
    .prepare("INSERT INTO chat_messages (site_id, author, body, is_creator) VALUES (?, ?, ?, ?)")
    .run(siteId, author, body, isCreator ? 1 : 0);
  return getChatMessage(Number(info.lastInsertRowid))!;
}

export function deleteChatMessage(id: number): void {
  db().prepare("DELETE FROM chat_messages WHERE id = ?").run(id);
}

export function countChatMessages(siteId: number): number {
  const r = db().prepare("SELECT COUNT(*) AS c FROM chat_messages WHERE site_id = ?").get(siteId) as { c: number };
  return r.c;
}

/* ---------- support tickets ---------- */

interface TicketRow {
  id: number;
  user_id: number;
  subject: string;
  body: string;
  status: string;
  reply: string;
  created_at: string;
}

function toTicket(r: TicketRow): SupportTicket {
  return {
    id: r.id,
    userId: r.user_id,
    subject: r.subject,
    body: r.body,
    status: r.status as SupportTicket["status"],
    reply: r.reply,
    createdAt: r.created_at,
  };
}

export function createTicket(userId: number, subject: string, body: string): SupportTicket {
  const info = db()
    .prepare("INSERT INTO support_tickets (user_id, subject, body) VALUES (?, ?, ?)")
    .run(userId, subject, body);
  const r = db().prepare("SELECT * FROM support_tickets WHERE id = ?").get(Number(info.lastInsertRowid)) as TicketRow;
  return toTicket(r);
}

export function getTicketsByUser(userId: number): SupportTicket[] {
  const rows = db()
    .prepare("SELECT * FROM support_tickets WHERE user_id = ? ORDER BY id DESC")
    .all(userId) as TicketRow[];
  return rows.map(toTicket);
}

export function getAllTickets(): Array<SupportTicket & { userEmail: string; userName: string }> {
  const rows = db()
    .prepare(
      `SELECT t.*, u.email AS user_email, u.name AS user_name
       FROM support_tickets t JOIN users u ON u.id = t.user_id ORDER BY t.id DESC`
    )
    .all() as Array<TicketRow & { user_email: string; user_name: string }>;
  return rows.map((r) => ({ ...toTicket(r), userEmail: r.user_email, userName: r.user_name }));
}

export function updateTicket(id: number, fields: { status?: string; reply?: string }): void {
  const r = db().prepare("SELECT * FROM support_tickets WHERE id = ?").get(id) as TicketRow | undefined;
  if (!r) return;
  db().prepare("UPDATE support_tickets SET status = ?, reply = ? WHERE id = ?").run(
    fields.status ?? r.status,
    fields.reply ?? r.reply,
    id
  );
}

/* ---------- page views ---------- */

export function recordPageView(siteId: number, referrer: string): void {
  db()
    .prepare(
      `INSERT INTO page_views (site_id, day, referrer, count) VALUES (?, date('now'), ?, 1)
       ON CONFLICT(site_id, day, referrer) DO UPDATE SET count = count + 1`
    )
    .run(siteId, referrer);
}

export function getTotalViews(siteId: number): number {
  const r = db().prepare("SELECT COALESCE(SUM(count), 0) AS c FROM page_views WHERE site_id = ?").get(siteId) as {
    c: number;
  };
  return r.c;
}

/** Views per day for the last `days` days, oldest first. Days with no views are omitted. */
export function getDailyViews(siteId: number, days: number): DailyViews[] {
  const rows = db()
    .prepare(
      `SELECT day, SUM(count) AS views FROM page_views
       WHERE site_id = ? AND day >= date('now', ?)
       GROUP BY day ORDER BY day`
    )
    .all(siteId, `-${days} days`) as Array<{ day: string; views: number }>;
  return rows;
}

export function getTopReferrers(siteId: number, limit = 8): ReferrerViews[] {
  const rows = db()
    .prepare(
      `SELECT referrer, SUM(count) AS views FROM page_views
       WHERE site_id = ? GROUP BY referrer ORDER BY views DESC LIMIT ?`
    )
    .all(siteId, limit) as Array<{ referrer: string; views: number }>;
  return rows;
}

/* ---------- custom domains ---------- */

interface DomainRow {
  site_id: number;
  hostname: string;
  created_at: string;
  last_seen: string | null;
  verify_token: string | null;
  verified_at: string | null;
}

function toDomain(r: DomainRow): CustomDomain {
  return {
    siteId: r.site_id,
    hostname: r.hostname,
    createdAt: r.created_at,
    lastSeen: r.last_seen,
    verifyToken: r.verify_token ?? "",
    verifiedAt: r.verified_at,
  };
}

export function getDomainBySite(siteId: number): CustomDomain | null {
  const r = db().prepare("SELECT * FROM custom_domains WHERE site_id = ?").get(siteId) as DomainRow | undefined;
  return r ? toDomain(r) : null;
}

/**
 * Exact hostname match first, then the www-flipped variant, so one record
 * covers both. Verified rows only: an unproven claim must never serve a page
 * or earn a certificate, which is the whole point of verifying.
 */
export function resolveDomain(hostname: string): CustomDomain | null {
  const h = hostname.toLowerCase();
  const flipped = h.startsWith("www.") ? h.slice(4) : `www.${h}`;
  const byHost = db().prepare("SELECT * FROM custom_domains WHERE hostname = ? AND verified_at IS NOT NULL");
  const r = (byHost.get(h) ?? byHost.get(flipped)) as DomainRow | undefined;
  return r ? toDomain(r) : null;
}

/**
 * Is this hostname spoken for? Only a verified claim counts.
 *
 * That distinction is the fix for squatting. Under the old rule, typing a
 * domain reserved it, so anyone could park a real customer's domain and lock
 * them out of their own name with no way to prove otherwise. An unverified
 * claim now blocks nobody.
 */
export function domainTaken(hostname: string, excludeSiteId?: number): boolean {
  const r = db()
    .prepare("SELECT site_id FROM custom_domains WHERE hostname = ? AND verified_at IS NOT NULL")
    .get(hostname) as { site_id: number } | undefined;
  return !!r && r.site_id !== excludeSiteId;
}

/**
 * Claim `hostname` for this site, unverified, with a fresh token.
 *
 * Any unverified claim another site holds on the same name is dropped: it was
 * proof of nothing, and the hostname column is unique. A verified one is not
 * touched, and the caller is expected to have refused already.
 */
export function claimCustomDomain(siteId: number, hostname: string, token: string): void {
  const tx = db().transaction(() => {
    db()
      .prepare("DELETE FROM custom_domains WHERE hostname = ? AND site_id != ? AND verified_at IS NULL")
      .run(hostname, siteId);
    db()
      .prepare(
        `INSERT INTO custom_domains (site_id, hostname, verify_token) VALUES (?, ?, ?)
         ON CONFLICT(site_id) DO UPDATE SET hostname = excluded.hostname, verify_token = excluded.verify_token,
           last_seen = NULL, verified_at = NULL, created_at = datetime('now')`
      )
      .run(siteId, hostname, token);
  });
  tx();
}

/** Ownership proved. From here the domain resolves and can earn a certificate. */
export function markDomainVerified(siteId: number): void {
  db().prepare("UPDATE custom_domains SET verified_at = datetime('now') WHERE site_id = ?").run(siteId);
}

export function deleteCustomDomain(siteId: number): void {
  db().prepare("DELETE FROM custom_domains WHERE site_id = ?").run(siteId);
}

/** A request for this domain reached us — DNS and the proxy chain work. */
export function touchDomain(siteId: number): void {
  db().prepare("UPDATE custom_domains SET last_seen = datetime('now') WHERE site_id = ?").run(siteId);
}

/* ---------- website connections ---------- */

interface ConnectionRow {
  site_id: number;
  url: string;
  enabled: number;
  last_scraped: string | null;
  last_seen: string | null;
  seen_host: string;
  needs_report: number | null;
}

function toConnection(r: ConnectionRow): Connection {
  return {
    siteId: r.site_id,
    url: r.url,
    enabled: r.enabled === 1,
    lastScraped: r.last_scraped,
    lastSeen: r.last_seen,
    seenHost: r.seen_host,
    needsReport: (r.needs_report ?? 1) === 1,
  };
}

export function getConnection(siteId: number): Connection | null {
  const r = db().prepare("SELECT * FROM connections WHERE site_id = ?").get(siteId) as ConnectionRow | undefined;
  return r ? toConnection(r) : null;
}

/**
 * Record a content report from the pasted snippet. Creates the connection on
 * the first report — there is no separate "connect" step any more, pasting
 * the snippet and loading the page is what pairs a site.
 */
export function upsertConnection(siteId: number, url: string): void {
  db()
    .prepare(
      `INSERT INTO connections (site_id, url, enabled, last_scraped, needs_report)
       VALUES (?, ?, 1, datetime('now'), 0)
       ON CONFLICT(site_id) DO UPDATE SET url = excluded.url, last_scraped = datetime('now'), needs_report = 0`
    )
    .run(siteId, url);
}

/** Ask the snippet to re-read the page next time it loads. */
export function setConnectionNeedsReport(siteId: number, needed: boolean): void {
  db().prepare("UPDATE connections SET needs_report = ? WHERE site_id = ?").run(needed ? 1 : 0, siteId);
}

export function setConnectionEnabled(siteId: number, enabled: boolean): void {
  db().prepare("UPDATE connections SET enabled = ? WHERE site_id = ?").run(enabled ? 1 : 0, siteId);
}

export function deleteConnection(siteId: number): void {
  const tx = db().transaction(() => {
    db().prepare("DELETE FROM connections WHERE site_id = ?").run(siteId);
    db().prepare("DELETE FROM site_content WHERE site_id = ?").run(siteId);
  });
  tx();
}

/** The pasted snippet phoned home — remember when and from where. */
export function touchConnection(siteId: number, host: string): void {
  db()
    .prepare("UPDATE connections SET last_seen = datetime('now'), seen_host = CASE WHEN ? != '' THEN ? ELSE seen_host END WHERE site_id = ?")
    .run(host, host, siteId);
}

/* ---------- extracted website content ---------- */

interface ContentRow {
  id: number;
  site_id: number;
  selector: string;
  kind: string;
  original: string;
  edited: string | null;
  position: number;
}

function toContentItem(r: ContentRow): ContentItem {
  return {
    id: r.id,
    siteId: r.site_id,
    selector: r.selector,
    kind: r.kind as ContentItem["kind"],
    original: r.original,
    edited: r.edited,
    position: r.position,
  };
}

export function countSiteContent(siteId: number): number {
  const r = db().prepare("SELECT COUNT(*) AS c FROM site_content WHERE site_id = ?").get(siteId) as { c: number };
  return r.c;
}

export function getSiteContent(siteId: number): ContentItem[] {
  const rows = db().prepare("SELECT * FROM site_content WHERE site_id = ? ORDER BY position").all(siteId) as ContentRow[];
  return rows.map(toContentItem);
}

export function getEditedContent(siteId: number): ContentItem[] {
  const rows = db()
    .prepare("SELECT * FROM site_content WHERE site_id = ? AND edited IS NOT NULL ORDER BY position")
    .all(siteId) as ContentRow[];
  return rows.map(toContentItem);
}

/**
 * Replace the extracted inventory after a (re)scan, carrying edits over to
 * items that still exist (same selector + kind + original content).
 */
export function replaceSiteContent(
  siteId: number,
  items: Array<{ selector: string; kind: string; original: string; position: number }>
): void {
  const d = db();
  const tx = d.transaction(() => {
    const previous = d.prepare("SELECT * FROM site_content WHERE site_id = ?").all(siteId) as ContentRow[];

    // Two ways to recognise a previously-edited item. The exact key is
    // preferred, but selectors legitimately change — a page redesign, or a
    // change to how we generate them — and matching on the content alone
    // rescues those edits instead of silently discarding them. Content keys
    // that aren't unique are dropped rather than guessed at.
    const byExact = new Map<string, string>();
    const byContent = new Map<string, string | null>();
    for (const p of previous) {
      if (p.edited === null) continue;
      byExact.set(`${p.selector}\x00${p.kind}\x00${p.original}`, p.edited);
      const ck = `${p.kind}\x00${p.original}`;
      byContent.set(ck, byContent.has(ck) ? null : p.edited);
    }

    d.prepare("DELETE FROM site_content WHERE site_id = ?").run(siteId);
    const insert = d.prepare(
      "INSERT INTO site_content (site_id, selector, kind, original, edited, position) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const it of items) {
      const edited =
        byExact.get(`${it.selector}\x00${it.kind}\x00${it.original}`) ??
        byContent.get(`${it.kind}\x00${it.original}`) ??
        null;
      insert.run(siteId, it.selector, it.kind, it.original, edited, it.position);
    }
  });
  tx();
}

export function setContentEdit(siteId: number, contentId: number, edited: string | null): void {
  db().prepare("UPDATE site_content SET edited = ? WHERE id = ? AND site_id = ?").run(edited, contentId, siteId);
}

/* ---------- social accounts & posts ---------- */

interface SocialAccountRow {
  id: number;
  site_id: number;
  platform: string;
  handle: string;
  auth_kind: string;
  secret: string;
  refresh_token: string;
  expires_at: string | null;
  external_id: string;
  created_at: string;
}

/** Safe shape for the UI — never includes stored credentials. */
export function getSocialAccounts(siteId: number): SocialAccount[] {
  const rows = db().prepare("SELECT * FROM social_accounts WHERE site_id = ? ORDER BY id").all(siteId) as SocialAccountRow[];
  return rows.map((r) => ({
    id: r.id,
    siteId: r.site_id,
    platform: r.platform,
    handle: r.handle,
    authKind: r.auth_kind as SocialAccount["authKind"],
    createdAt: r.created_at,
  }));
}

/** Full row including credentials — server-side publishing only. */
export function getSocialAccountAuth(siteId: number, platform: string): SocialAccountAuth | null {
  const r = db()
    .prepare("SELECT * FROM social_accounts WHERE site_id = ? AND platform = ?")
    .get(siteId, platform) as SocialAccountRow | undefined;
  if (!r) return null;
  return {
    platform: r.platform,
    handle: r.handle,
    authKind: r.auth_kind as SocialAccountAuth["authKind"],
    secret: r.secret,
    refreshToken: r.refresh_token,
    expiresAt: r.expires_at,
    externalId: r.external_id,
  };
}

export function upsertSocialAccount(
  siteId: number,
  platform: string,
  handle: string,
  auth?: { authKind?: string; secret?: string; refreshToken?: string; expiresAt?: string | null; externalId?: string }
): void {
  db()
    .prepare(
      `INSERT INTO social_accounts (site_id, platform, handle, auth_kind, secret, refresh_token, expires_at, external_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(site_id, platform) DO UPDATE SET
         handle = excluded.handle, auth_kind = excluded.auth_kind, secret = excluded.secret,
         refresh_token = excluded.refresh_token, expires_at = excluded.expires_at, external_id = excluded.external_id`
    )
    .run(
      siteId,
      platform,
      handle,
      auth?.authKind ?? "handle",
      auth?.secret ?? "",
      auth?.refreshToken ?? "",
      auth?.expiresAt ?? null,
      auth?.externalId ?? ""
    );
}

export function deleteSocialAccount(siteId: number, platform: string): void {
  db().prepare("DELETE FROM social_accounts WHERE site_id = ? AND platform = ?").run(siteId, platform);
}

interface SocialStatRow {
  id: number;
  site_id: number;
  platform: string;
  metric: string;
  day: string;
  count: number;
  note: string;
  created_at: string;
}

function toSocialStat(r: SocialStatRow): SocialStat {
  return { id: r.id, siteId: r.site_id, platform: r.platform,
    metric: r.metric, day: r.day, count: r.count, note: r.note, createdAt: r.created_at };
}

/** All recorded counts for a site, oldest first (chart and delta order). */
export function getSocialStats(siteId: number): SocialStat[] {
  const rows = db()
    .prepare("SELECT * FROM social_stats WHERE site_id = ? ORDER BY day, id")
    .all(siteId) as SocialStatRow[];
  return rows.map(toSocialStat);
}

/**
 * Record a count for one platform on one date. A second entry for the same
 * date overwrites the first — re-typing a date is how a typo gets corrected,
 * and two competing counts for the same day would mean nothing anyway.
 */
export function upsertSocialStat(
  siteId: number,
  platform: string,
  metric: string,
  day: string,
  count: number,
  note: string
): void {
  db()
    .prepare(
      `INSERT INTO social_stats (site_id, platform, metric, day, count, note) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(site_id, platform, metric, day) DO UPDATE SET count = excluded.count, note = excluded.note`
    )
    .run(siteId, platform, metric, day, count, note);
}

/** The site_id guard makes ownership part of the delete itself. */
export function deleteSocialStat(siteId: number, statId: number): void {
  db().prepare("DELETE FROM social_stats WHERE id = ? AND site_id = ?").run(statId, siteId);
}

interface SocialPostRow {
  id: number;
  site_id: number;
  body: string;
  media_url: string;
  created_at: string;
}

export function createSocialPost(siteId: number, body: string, mediaUrl: string, platforms: string[]): number {
  const d = db();
  let postId = 0;
  const tx = d.transaction(() => {
    const info = d
      .prepare("INSERT INTO social_posts (site_id, body, media_url) VALUES (?, ?, ?)")
      .run(siteId, body, mediaUrl);
    postId = Number(info.lastInsertRowid);
    const insert = d.prepare("INSERT INTO social_post_targets (post_id, platform) VALUES (?, ?)");
    for (const p of platforms) insert.run(postId, p);
  });
  tx();
  return postId;
}

/** Targets of one post that still need a publish attempt, with ownership check. */
export function getPendingTargets(siteId: number, postId: number): Array<{ id: number; platform: string }> {
  return db()
    .prepare(
      `SELECT t.id, t.platform FROM social_post_targets t
       JOIN social_posts p ON p.id = t.post_id
       WHERE p.id = ? AND p.site_id = ? AND t.status != 'posted'`
    )
    .all(postId, siteId) as Array<{ id: number; platform: string }>;
}

export function getPostForSite(siteId: number, postId: number): { id: number; body: string; mediaUrl: string } | null {
  const r = db()
    .prepare("SELECT id, body, media_url FROM social_posts WHERE id = ? AND site_id = ?")
    .get(postId, siteId) as SocialPostRow | undefined;
  return r ? { id: r.id, body: r.body, mediaUrl: r.media_url } : null;
}

export function updateTargetStatus(targetId: number, status: string, detail: string): void {
  db().prepare("UPDATE social_post_targets SET status = ?, detail = ? WHERE id = ?").run(status, detail.slice(0, 500), targetId);
}

/* ---------- follower counts ---------- */

/**
 * Record what a platform's follower count was on a given day.
 *
 * `source` marks where the number came from. Everything is "manual" today;
 * when platform APIs are wired up they write the same rows tagged with the
 * platform, so a creator can tell a figure they typed from one that was
 * measured — and so an automatic reading can be told apart from a hand
 * correction to the same day.
 */
export function recordFollowerCount(
  siteId: number,
  platform: string,
  day: string,
  count: number,
  source = "manual"
): void {
  db()
    .prepare(
      `INSERT INTO follower_counts (site_id, platform, day, count, source) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(site_id, platform, day) DO UPDATE SET count = excluded.count, source = excluded.source`
    )
    .run(siteId, platform, day, count, source);
}

/** Every reading for a site, oldest first. */
export function getFollowerHistory(siteId: number): FollowerSnapshot[] {
  return db()
    .prepare(
      `SELECT platform, day, count, source FROM follower_counts
       WHERE site_id = ? ORDER BY day, platform`
    )
    .all(siteId) as FollowerSnapshot[];
}

/**
 * What each platform's follower count was on a given date.
 *
 * Nobody logs every single day, so an exact hit on the requested date is the
 * exception rather than the rule. The honest reading of "how many followers
 * did I have on the 3rd" is the most recent count taken on or before the 3rd,
 * which is what this returns — carrying `measuredOn` so the UI can be straight
 * about a figure that was actually read a fortnight earlier.
 */
export function getFollowerCountsOn(siteId: number, day: string): FollowerReading[] {
  return db()
    .prepare(
      `SELECT platform, count, day AS measuredOn, source FROM follower_counts f
       WHERE site_id = ? AND day <= ?
         AND day = (SELECT MAX(day) FROM follower_counts
                    WHERE site_id = ? AND platform = f.platform AND day <= ?)
       ORDER BY count DESC, platform`
    )
    .all(siteId, day, siteId, day) as FollowerReading[];
}

/** The days a site has any reading on, oldest first — drives the date list. */
export function getFollowerDays(siteId: number): string[] {
  const rows = db()
    .prepare("SELECT DISTINCT day FROM follower_counts WHERE site_id = ? ORDER BY day")
    .all(siteId) as Array<{ day: string }>;
  return rows.map((r) => r.day);
}

/** Drop one platform's reading for one day. */
export function deleteFollowerCount(siteId: number, platform: string, day: string): void {
  db().prepare("DELETE FROM follower_counts WHERE site_id = ? AND platform = ? AND day = ?").run(siteId, platform, day);
}

export function countSocialPosts(siteId: number): number {
  const r = db().prepare("SELECT COUNT(*) AS c FROM social_posts WHERE site_id = ?").get(siteId) as { c: number };
  return r.c;
}

export function getSocialPosts(siteId: number, limit = 20): SocialPost[] {
  const posts = db()
    .prepare("SELECT * FROM social_posts WHERE site_id = ? ORDER BY id DESC LIMIT ?")
    .all(siteId, limit) as SocialPostRow[];
  const targets = db().prepare("SELECT post_id, platform, status, detail FROM social_post_targets WHERE post_id IN (SELECT id FROM social_posts WHERE site_id = ? ORDER BY id DESC LIMIT ?)").all(siteId, limit) as Array<{ post_id: number; platform: string; status: string; detail: string }>;
  return posts.map((p) => ({
    id: p.id,
    siteId: p.site_id,
    body: p.body,
    mediaUrl: p.media_url,
    createdAt: p.created_at,
    targets: targets
      .filter((t) => t.post_id === p.id)
      .map((t) => ({ platform: t.platform, status: t.status as SocialPost["targets"][number]["status"], detail: t.detail })),
  }));
}

export interface LatestStat {
  platform: string;
  metric: string;
  day: string;
  count: number;
  /** The reading before this one, for a change figure. Null when it is the first. */
  previous: number | null;
}

/**
 * The most recent reading for every platform-and-metric pair, with the one
 * before it.
 *
 * Grouped here rather than in SQL: readings are sparse and few, a window
 * function would need SQLite 3.25 features this file otherwise avoids, and the
 * result is the same handful of rows either way.
 */
export function getLatestSocialStats(siteId: number): LatestStat[] {
  const rows = db()
    .prepare("SELECT platform, metric, day, count FROM social_stats WHERE site_id = ? ORDER BY platform, metric, day DESC")
    .all(siteId) as Array<{ platform: string; metric: string; day: string; count: number }>;

  const out: LatestStat[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const key = `${r.platform}:${r.metric}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const next = rows[i + 1];
    const previous = next && next.platform === r.platform && next.metric === r.metric ? next.count : null;
    out.push({ platform: r.platform, metric: r.metric, day: r.day, count: r.count, previous });
  }
  return out;
}
