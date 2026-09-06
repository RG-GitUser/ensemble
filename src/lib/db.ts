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

function tableExists(d: Database.Database, name: string): boolean {
  return !!d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function tableHasIndex(d: Database.Database, table: string, index: string): boolean {
  return (d.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string }>).some((i) => i.name === index);
}

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
    -- A subscription we failed to cancel while deleting the account it
    -- belonged to. Deliberately NOT foreign-keyed to users or sites: the whole
    -- point is that it outlives them. Without this the pointer was simply
    -- dropped, the card kept being charged, and every later webhook looked the
    -- customer up, found nothing and returned silently — so nothing would ever
    -- surface it and the customer's only remedy was a chargeback.
    -- The creator's edits, as they were just before a report replaced them.
    -- A report arrives with nothing but a token that ships in public HTML, and
    -- it clears the whole inventory — so an undo has to exist independently of
    -- whoever sent the report.
    CREATE TABLE IF NOT EXISTS content_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      payload TEXT NOT NULL,
      edited_count INTEGER NOT NULL DEFAULT 0,
      taken_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS billing_orphans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stripe_customer_id TEXT NOT NULL DEFAULT '',
      stripe_subscription_id TEXT NOT NULL DEFAULT '',
      user_email TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );
    CREATE TABLE IF NOT EXISTS follower_counts (
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      day TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual',
      PRIMARY KEY (site_id, platform, day)
    );
    -- Relay egress, per site per calendar month.
    --
    -- Forwarding one stream to three platforms is roughly 8 GB/hour, against a
    -- droplet allowance measured in terabytes, so a single creator can spend
    -- the whole month's transfer in a few days. Nothing counted it: the only
    -- control was a box-level vnstat warning that fires after the overage is
    -- already committed and cannot say who caused it.
    --
    -- Bytes are reported by the relay at the end of each stream. Month is
    -- 'YYYY-MM' in UTC, so the window does not shift with the server's zone.
    CREATE TABLE IF NOT EXISTS live_usage (
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (site_id, month)
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
  //
  // The rebuild runs inside ONE transaction. db.exec() auto-commits each
  // statement separately, so the old code could be killed between the DROP and
  // the RENAME — and because the service runs Restart=always, the next boot was
  // three seconds later. CREATE TABLE IF NOT EXISTS above would then recreate
  // social_stats empty, WITH the metric column, so this guard read as
  // already-migrated and never ran again: every growth reading gone, silently.
  // The second branch folds the rows back for any database left in that state.
  const ssCols = new Set((db.prepare("PRAGMA table_info(social_stats)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!ssCols.has("metric")) {
    db.transaction(() => {
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
    })();
  } else if (tableExists(db, "social_stats_rebuilt")) {
    // Interrupted by the pre-transaction code: the real rows are stranded in
    // social_stats_rebuilt behind an empty social_stats. Carry them back.
    db.transaction(() => {
      db.exec(`
        INSERT OR IGNORE INTO social_stats (id, site_id, platform, metric, day, count, note, created_at)
          SELECT id, site_id, platform, metric, day, count, note, created_at FROM social_stats_rebuilt;
        DROP TABLE social_stats_rebuilt;
      `);
    })();
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
  //
  // Backfilled only where last_seen proves the domain really did point here.
  // The old rule let anyone reserve a hostname by typing it, and stamping
  // those rows verified would lock every squat in permanently — domainTaken
  // refuses the real owner before they can reach the step that proves it.
  // One transaction, so an interrupt cannot leave the column added and the
  // backfill unapplied (which would dark every custom domain at once, because
  // resolveDomain requires verified_at).
  if (!domCols.has("verified_at")) {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE custom_domains ADD COLUMN verified_at TEXT;
        UPDATE custom_domains SET verified_at = datetime('now')
          WHERE verified_at IS NULL AND last_seen IS NOT NULL;
      `);
    })();
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
  // One transaction: dying between the ALTER and the backfill would greet every
  // existing customer with the first-run walkthrough, which is precisely what
  // the note above says must not happen.
  if (!prefCols.has("welcomed")) {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE user_prefs ADD COLUMN welcomed INTEGER NOT NULL DEFAULT 0;
        INSERT INTO user_prefs (user_id, tutorials_enabled, tours_seen, welcomed)
          SELECT id, 1, '', 1 FROM users WHERE id NOT IN (SELECT user_id FROM user_prefs);
        UPDATE user_prefs SET welcomed = 1;
      `);
    })();
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

  // Nothing used to stop the same address subscribing twice — a double-tap on
  // the button did it — and each row carried its own unsub_token, so clicking
  // unsubscribe in one email cleared one copy and the rest kept sending. That
  // is a CAN-SPAM and GDPR exposure on the platform's own sending domain, so
  // the constraint belongs in the schema rather than in the caller.
  //
  // Collapsing existing duplicates keeps the OLDEST row and carries any
  // opt-out across to it: if an address unsubscribed from any copy, the
  // survivor stays unsubscribed. Silently re-subscribing someone who had
  // opted out would be the one unacceptable outcome here.
  if (!tableHasIndex(db, "leads", "idx_leads_site_email")) {
    db.transaction(() => {
      db.exec(`
        UPDATE leads SET email = lower(email);
        UPDATE leads
           SET unsubscribed_at = COALESCE(
                 unsubscribed_at,
                 (SELECT MIN(l2.unsubscribed_at) FROM leads l2
                   WHERE l2.site_id = leads.site_id AND l2.email = leads.email
                     AND l2.unsubscribed_at IS NOT NULL))
         WHERE id IN (SELECT MIN(id) FROM leads GROUP BY site_id, email);
        DELETE FROM leads WHERE id NOT IN (SELECT MIN(id) FROM leads GROUP BY site_id, email);
      `);
      // unsub_token is about to become UNIQUE. The values are 16 random bytes
      // so a collision is vanishingly unlikely, but a duplicate would fail the
      // index and take the whole app down at boot — reissue instead.
      const dupeTokens = db
        .prepare("SELECT unsub_token FROM leads GROUP BY unsub_token HAVING COUNT(*) > 1")
        .all() as Array<{ unsub_token: string }>;
      for (const { unsub_token } of dupeTokens) {
        const rows = db.prepare("SELECT id FROM leads WHERE unsub_token = ?").all(unsub_token) as Array<{ id: number }>;
        for (const row of rows.slice(1)) setLeadToken.run(randomBytes(16).toString("hex"), row.id);
      }
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_site_email ON leads(site_id, email);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unsub_token ON leads(unsub_token);
      `);
    })();
  }

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

  // Indexes on every child foreign-key column we actually query by.
  //
  // Composite primary keys already cover page_views, follower_counts,
  // social_stats and social_accounts by their site_id prefix, and
  // custom_domains.hostname is covered by its UNIQUE — everything else was
  // table-scanning, including getSections on every public page render.
  //
  // The compounding factor is PRAGMA foreign_keys = ON: without these, each
  // cascading delete does a full child-table scan per parent row, so one
  // account deletion blocks the single Node process for every other tenant.
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sections_site_position ON sections(site_id, position);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose ON auth_tokens(user_id, purpose);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_leads_site ON leads(site_id);
    CREATE INDEX IF NOT EXISTS idx_newsletter_posts_site ON newsletter_posts(site_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_site ON chat_messages(site_id, id);
    CREATE INDEX IF NOT EXISTS idx_quote_requests_user ON quote_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_site_content_site_position ON site_content(site_id, position);
    CREATE INDEX IF NOT EXISTS idx_content_snapshots_site ON content_snapshots(site_id, id);
    CREATE INDEX IF NOT EXISTS idx_social_posts_site ON social_posts(site_id, id);
    CREATE INDEX IF NOT EXISTS idx_social_post_targets_post ON social_post_targets(post_id);
    CREATE INDEX IF NOT EXISTS idx_sites_stripe_subscription ON sites(stripe_subscription_id);
    CREATE INDEX IF NOT EXISTS idx_sites_stripe_customer ON sites(stripe_customer_id);
  `);

  // One verified recovery address, one account.
  //
  // backup_email had no uniqueness constraint, so the same address could be
  // confirmed on two accounts — after which getUserByBackupEmail returned
  // whichever row SQLite felt like and the second account was permanently
  // unrecoverable, with the form still reporting that a link had been sent.
  // Existing duplicates are cleared on the LATER accounts (the earlier claim
  // stands) so those owners are prompted to add one again, rather than being
  // left with a recovery address that silently does nothing.
  if (!tableHasIndex(db, "users", "idx_users_backup_email")) {
    db.transaction(() => {
      const dupes = db
        .prepare(
          `SELECT id FROM users WHERE backup_verified_at > 0 AND backup_email <> ''
             AND id NOT IN (
               SELECT MIN(id) FROM users WHERE backup_verified_at > 0 AND backup_email <> ''
               GROUP BY lower(backup_email)
             )`
        )
        .all() as Array<{ id: number }>;
      if (dupes.length > 0) {
        console.warn(`[db] cleared ${dupes.length} duplicate recovery address(es); those accounts must add one again`);
        const clear = db.prepare("UPDATE users SET backup_email = '', backup_verified_at = 0 WHERE id = ?");
        for (const d of dupes) clear.run(d.id);
      }
      db.exec("UPDATE users SET backup_email = lower(backup_email) WHERE backup_email <> ''");
      db.exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_backup_email
           ON users(backup_email) WHERE backup_email <> '' AND backup_verified_at > 0`
      );
    })();
  }

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
 * Hash a seeded password in the same format src/lib/auth.ts writes.
 *
 * Synchronous here on purpose: this runs once at boot, before the server takes
 * requests, so there is no event loop to protect. The parameters are recorded
 * in the string so this hash can be upgraded on first login like any other —
 * keep the shape in step with hashPassword in auth.ts.
 */
function seedHash(password: string): string {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N, r, p }).toString("hex");
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`;
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
  const info = d
    .prepare("INSERT INTO users (email, password_hash, name, business_name) VALUES (?, ?, ?, ?)")
    .run(email, seedHash(password), "Site Admin", "Ensemble");
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
const g = globalThis as unknown as {
  __appDb?: Database.Database;
  __appDbSeeded?: boolean;
  __appDbPruneTimer?: ReturnType<typeof setInterval>;
};
function db(): Database.Database {
  const d = (g.__appDb ??= createDb());
  if (!g.__appDbSeeded) {
    seedDemo(d);
    seedDemoChat(d);
    seedAdmin(d);
    // Set BEFORE the sweep: pruneExpired calls db() itself, and this is what
    // stops it recursing back through seeding.
    g.__appDbSeeded = true;
    startPruneSweep();
  }
  return d;
}

const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Sweep expired rows at startup and daily thereafter. See pruneExpired. */
function startPruneSweep(): void {
  if (g.__appDbPruneTimer) return;
  const sweep = () => {
    try {
      const { sessions, tokens, pageViews } = pruneExpired();
      if (sessions || tokens || pageViews) {
        console.log(`[db] pruned ${sessions} sessions, ${tokens} auth tokens, ${pageViews} page-view rows`);
      }
    } catch (err) {
      console.error("[db] prune sweep failed:", err);
    }
  };
  sweep();
  const timer = setInterval(sweep, PRUNE_INTERVAL_MS);
  // Never hold the process open just for the sweep.
  timer.unref?.();
  g.__appDbPruneTimer = timer;
}

/* ---------- row mappers ---------- */

/**
 * JSON.parse on the hot read paths, guarded.
 *
 * toSite and toSection run on every public render, every dashboard page and
 * the Stripe webhook. One truncated blob — a disk-full write, a bad restore —
 * used to throw straight out of getSiteBySlug: the creator's page 500s, their
 * dashboard 500s, and the webhook route starts failing so Stripe retries it.
 * Falling back to defaults keeps one bad row from taking down everything that
 * tenant owns, and leaves a line in the log saying which row to look at.
 */
function parseJson<T>(raw: string | null | undefined, fallback: T, what: string): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Corrupt JSON in ${what} — falling back to defaults:`, err);
    return fallback;
  }
}

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
      ...parseJson<Record<string, unknown>>(r.config, {}, `sites.config (site ${r.id})`),
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
    content: parseJson<Record<string, string>>(r.content, {}, `sections.content (section ${r.id})`),
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
    // The three the docblock promised and the code left behind.
    // follower_counts is the table the Followers chart actually renders from,
    // so without it the creator's own growth history was still on screen after
    // they pressed the button. newsletter_posts holds every broadcast's full
    // body and recipient count; site_content holds material scraped from the
    // creator's external website.
    d.prepare("DELETE FROM follower_counts WHERE site_id = ?").run(siteId);
    d.prepare("DELETE FROM newsletter_posts WHERE site_id = ?").run(siteId);
    d.prepare("DELETE FROM site_content WHERE site_id = ?").run(siteId);
    d.prepare("DELETE FROM live_usage WHERE site_id = ?").run(siteId);
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

/**
 * Delete what has expired.
 *
 * Nothing here was ever pruned: getSessionUser filters expired rows but never
 * removes them, so every browser that ever signed in left a permanent row, and
 * spent tokens for a purpose never requested again lived forever. After a year
 * that is hundreds of thousands of dead rows that every password reset and
 * every account deletion had to scan. Page views get a retention window for
 * the same reason — the WAL never checkpoints down, and the backup grows with
 * it.
 *
 * Cheap enough to run on boot and on a timer; returns what it removed so the
 * caller can log something honest.
 */
export function pruneExpired(pageViewRetentionDays = 400): { sessions: number; tokens: number; pageViews: number } {
  const d = db();
  const now = Date.now();
  return d.transaction(() => ({
    sessions: d.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now).changes,
    tokens: d.prepare("DELETE FROM auth_tokens WHERE expires_at <= ? OR used_at > 0").run(now).changes,
    pageViews: d
      .prepare("DELETE FROM page_views WHERE day < date('now', ?)")
      .run(`-${pageViewRetentionDays} days`).changes,
  }))();
}

export interface BillingOrphan {
  id: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  userEmail: string;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
}

/** Record a subscription that outlived the account it belonged to. */
export function recordBillingOrphan(o: {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  userEmail: string;
  reason: string;
}): void {
  db()
    .prepare(
      `INSERT INTO billing_orphans (stripe_customer_id, stripe_subscription_id, user_email, reason)
       VALUES (?, ?, ?, ?)`
    )
    .run(o.stripeCustomerId, o.stripeSubscriptionId, o.userEmail, o.reason.slice(0, 500));
}

/** Outstanding orphans, for the admin page to act on. */
export function getBillingOrphans(): BillingOrphan[] {
  const rows = db()
    .prepare("SELECT * FROM billing_orphans WHERE resolved_at IS NULL ORDER BY id DESC")
    .all() as Array<{
    id: number;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    user_email: string;
    reason: string;
    created_at: string;
    resolved_at: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    stripeCustomerId: r.stripe_customer_id,
    stripeSubscriptionId: r.stripe_subscription_id,
    userEmail: r.user_email,
    reason: r.reason,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }));
}

export function resolveBillingOrphan(id: number): void {
  db().prepare("UPDATE billing_orphans SET resolved_at = datetime('now') WHERE id = ?").run(id);
}

/**
 * Cheapest possible proof that the database is open and answering. Throws if
 * it isn't, which is exactly what /api/health wants to know.
 */
export function healthCheck(): void {
  db().prepare("SELECT 1").get();
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

/**
 * Sign out every OTHER browser.
 *
 * What "change my password" has to mean, and what the account had no way to do:
 * endSession only ever dropped the caller's own token, so a borrowed laptop
 * stayed signed in for the full thirty days.
 */
export function deleteSessionsExcept(userId: number, keepToken: string): number {
  return db().prepare("DELETE FROM sessions WHERE user_id = ? AND token <> ?").run(userId, keepToken).changes;
}

/** Replace a password hash in place — used by change-password and rehash-on-login. */
export function setPasswordHash(userId: number, passwordHash: string): void {
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
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
class AbortConsume extends Error {}

function consumeAuthToken(
  token: string,
  purpose: AuthTokenPurpose,
  /** Return false to refuse the link and roll the whole transaction back. */
  apply: (d: ReturnType<typeof db>, userId: number, payload: string) => boolean | void
): boolean {
  const d = db();
  const run = d.transaction(() => {
    const row = d
      .prepare("SELECT user_id, payload FROM auth_tokens WHERE token = ? AND purpose = ? AND used_at = 0 AND expires_at > ?")
      .get(token, purpose, Date.now()) as { user_id: number; payload: string } | undefined;
    if (!row) return false;
    d.prepare("UPDATE auth_tokens SET used_at = ? WHERE token = ?").run(Date.now(), token);
    if (apply(d, row.user_id, row.payload) === false) throw new AbortConsume();
    return true;
  });
  try {
    return run();
  } catch (err) {
    if (err instanceof AbortConsume) return false;
    throw err;
  }
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
    // Every other pending link dies too. createAuthToken only ever replaced
    // links of the SAME purpose, so a password reset used to leave an
    // outstanding recovery link alive — meaning someone who saw a suspicious
    // email and did the two obvious things, reset the password and removed the
    // recovery address, was still taken over up to 45 minutes later.
    d.prepare("DELETE FROM auth_tokens WHERE user_id = ?").run(userId);
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
    // The backup address must STILL be verified at the moment the link is
    // spent, not merely when it was sent. Otherwise removing a recovery
    // address you didn't recognise does nothing about the link already in
    // someone else's inbox.
    const u = d.prepare("SELECT backup_verified_at FROM users WHERE id = ?").get(userId) as
      | { backup_verified_at: number }
      | undefined;
    if (!u || !u.backup_verified_at) return false;
    d.prepare("UPDATE users SET email = ?, password_hash = ? WHERE id = ?").run(newEmail, passwordHash, userId);
    d.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    d.prepare("DELETE FROM auth_tokens WHERE user_id = ?").run(userId);
  });
}

/**
 * True for an account deliberately locked out of every credential path.
 *
 * The demo account's hash is an unforgeable sentinel so it "can never be
 * logged into" — but requestPasswordReset had no exclusion list and would
 * happily mail a WORKING reset link to demo@ensemble.app, an address on a
 * domain that is not one the platform uses anywhere else in this codebase.
 * Whoever receives mail there would own the published /demo site, its leads
 * and its chat.
 */
export function isLockedAccount(passwordHash: string): boolean {
  return passwordHash === DEMO_LOCKED_HASH;
}

/**
 * The stored hash for an account that has only ever signed in with Google,
 * Microsoft or Yahoo.
 *
 * password_hash is NOT NULL and every login path reads it, so an OAuth-only
 * account still needs a value there. Same trick as the demo lock, different
 * constant so the two can never be mistaken for each other: it parses as a
 * legacy `salt:hash` pair, and verifying any password against it would mean
 * finding an input whose scrypt output is 64 bytes of 0x11. Nothing matches
 * it, so "sign in with password" cannot be used against an account that has
 * never set one.
 *
 * Password reset deliberately still works on these accounts. The provider has
 * verified the address, so the mailbox is genuinely theirs, and someone who
 * loses access to their Google account should not lose their site with it.
 * Setting a password simply replaces this sentinel.
 */
const OAUTH_ONLY_HASH = "1".repeat(32) + ":" + "1".repeat(128);

export function oauthOnlyHash(): string {
  return OAUTH_ONLY_HASH;
}

/** True when this account has no password of its own — it signs in elsewhere. */
export function isOAuthOnlyAccount(passwordHash: string): boolean {
  return passwordHash === OAUTH_ONLY_HASH;
}

/**
 * The single account holding this address as a verified backup, if any.
 *
 * ORDER BY id so the answer is deterministic. Combined with the unique index
 * on verified backup addresses, one address can now only ever belong to one
 * account — before, a second account claiming the same address was
 * permanently unrecoverable while the form still said a link had been sent.
 */
export function getUserByBackupEmail(email: string): User | null {
  const r = db()
    .prepare("SELECT * FROM users WHERE backup_email = ? AND backup_verified_at > 0 ORDER BY id LIMIT 1")
    .get(email.trim().toLowerCase()) as UserRow | undefined;
  return r ? toUser(r) : null;
}

/**
 * Clear a recovery address without needing a round trip through email.
 *
 * Kills the pending links with it — removing the address is the action someone
 * takes when they think it is not theirs, and leaving a live recovery or
 * verification link behind would make that gesture meaningless.
 */
export function clearBackupEmail(userId: number): void {
  const d = db();
  d.transaction(() => {
    d.prepare("UPDATE users SET backup_email = '', backup_verified_at = 0 WHERE id = ?").run(userId);
    d.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND purpose IN ('recover_login', 'verify_backup')").run(userId);
  })();
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

/**
 * True when an error is SQLite refusing a duplicate.
 *
 * Slug and hostname uniqueness are checked before the write and enforced by
 * the index, and the gap between the two is a real race: without this the
 * loser gets a raw SQLITE_CONSTRAINT_UNIQUE 500 instead of "that page URL is
 * taken".
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    typeof (err as { code?: unknown }).code === "string" &&
    (err as { code: string }).code.startsWith("SQLITE_CONSTRAINT")
  );
}

export function slugTaken(slug: string, excludeSiteId?: number): boolean {
  const r = db().prepare("SELECT id FROM sites WHERE slug = ?").get(slug) as { id: number } | undefined;
  return !!r && r.id !== excludeSiteId;
}

/**
 * Update only the columns named in `fields`.
 *
 * It used to write every column on every call, reading the current row first
 * and putting it back. Because toSite merges SITE_CONFIG_DEFAULTS on the way
 * in, that meant a call touching only `plan` — a Stripe webhook is enough —
 * persisted the entire default palette as if the creator had chosen it. Change
 * a default six months later and those sites are frozen on the old one,
 * indistinguishable from a deliberate choice, which also breaks the setup
 * checklist: its whole method is comparing against the defaults to tell
 * "chosen" from "shipped".
 *
 * Config is stored exactly as handed over. Callers wanting to change one key
 * should use patchSiteConfig, which merges inside a transaction.
 */
export function updateSite(id: number, fields: { slug?: string; plan?: string; published?: boolean; config?: object }): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.slug !== undefined) { sets.push("slug = ?"); vals.push(fields.slug); }
  if (fields.plan !== undefined) { sets.push("plan = ?"); vals.push(fields.plan); }
  if (fields.published !== undefined) { sets.push("published = ?"); vals.push(fields.published ? 1 : 0); }
  if (fields.config !== undefined) { sets.push("config = ?"); vals.push(JSON.stringify(fields.config)); }
  if (!sets.length) return;
  vals.push(id);
  db().prepare(`UPDATE sites SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

/**
 * Merge a patch into a site's config inside one transaction.
 *
 * better-sqlite3 being synchronous makes a single JS turn atomic, which
 * genuinely protects a read-modify-write that stays in one turn. It protects
 * nothing across an `await`: updateTheme reads the config, runs four image
 * pipelines — seconds for a large background — then writes its pre-await
 * snapshot back, and anything that landed in between is gone. The case that
 * bit was MediaMTX posting `live: true` during that window: the theme save
 * reverted liveNow to false, and because the relay only posts on state change
 * it never fired again, so the creator streamed for an hour with a dark badge.
 *
 * Reads the RAW stored blob rather than a defaults-merged Site, so merging
 * never persists a default the creator did not pick. An explicit `undefined`
 * in the patch removes the key.
 */
/**
 * Add relay egress to a site's running total for a month.
 *
 * Accumulated rather than set, because one month holds many streams and the
 * relay reports each one as it ends. Non-finite, negative and absurd values
 * are dropped rather than stored: this number decides whether someone may
 * broadcast, so a garbled report must not be able to lock a creator out (or,
 * with a negative, hand them free transfer).
 */
export function addLiveUsage(siteId: number, month: string, bytes: number): void {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  const safe = Math.min(Math.floor(bytes), Number.MAX_SAFE_INTEGER);
  db()
    .prepare(
      `INSERT INTO live_usage (site_id, month, bytes) VALUES (?, ?, ?)
       ON CONFLICT(site_id, month) DO UPDATE SET bytes = bytes + excluded.bytes`
    )
    .run(siteId, month, safe);
}

/** Relay egress a site has already spent this month, in bytes. */
export function getLiveUsage(siteId: number, month: string): number {
  const row = db()
    .prepare("SELECT bytes FROM live_usage WHERE site_id = ? AND month = ?")
    .get(siteId, month) as { bytes: number } | undefined;
  return row?.bytes ?? 0;
}

export function patchSiteConfig(id: number, patch: Record<string, unknown>): void {
  const d = db();
  d.transaction(() => {
    const row = d.prepare("SELECT config FROM sites WHERE id = ?").get(id) as { config: string } | undefined;
    if (!row) return;
    const current = parseJson<Record<string, unknown>>(row.config, {}, `sites.config (site ${id})`);
    const next: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete next[k];
      else next[k] = v;
    }
    d.prepare("UPDATE sites SET config = ? WHERE id = ?").run(JSON.stringify(next), id);
  })();
}

/**
 * Write billing state, refusing anything older than what we already applied.
 *
 * The ordering guard lives HERE rather than in the webhook branches, because
 * it was previously written out by hand in one branch of six: the three
 * checkout.session.* branches and subscription.deleted all stamped
 * billing_event_at with no comparison, so a Stripe retry of an older event
 * both applied it AND rewound the watermark, re-arming every other stale event
 * in the window. One choke point means no branch can bypass it.
 *
 * Returns whether the write landed, so a caller can tell "applied" from
 * "refused as stale".
 */
export function setSiteBilling(
  id: number,
  fields: { stripeCustomerId?: string; stripeSubscriptionId?: string; billingStatus?: string; billingEventAt?: number }
): boolean {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.stripeCustomerId !== undefined) { sets.push("stripe_customer_id = ?"); vals.push(fields.stripeCustomerId); }
  if (fields.stripeSubscriptionId !== undefined) { sets.push("stripe_subscription_id = ?"); vals.push(fields.stripeSubscriptionId); }
  if (fields.billingStatus !== undefined) { sets.push("billing_status = ?"); vals.push(fields.billingStatus); }
  if (fields.billingEventAt !== undefined) { sets.push("billing_event_at = ?"); vals.push(fields.billingEventAt); }
  if (!sets.length) return false;

  let sql = `UPDATE sites SET ${sets.join(", ")} WHERE id = ?`;
  vals.push(id);
  if (fields.billingEventAt !== undefined) {
    sql += " AND billing_event_at <= ?";
    vals.push(fields.billingEventAt);
  }
  return db().prepare(sql).run(...vals).changes > 0;
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
  const rows = db()
    .prepare("SELECT * FROM sections WHERE site_id = ? ORDER BY position, id")
    .all(siteId) as SectionRow[];
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

/**
 * The longest a single section field may be.
 *
 * Section content was the only free-text write in the app with no cap, so one
 * field could hold megabytes — rendered on every page view and shipped in
 * every RSC payload, for every visitor. Generous enough for the longest
 * about-page anyone writes.
 */
export const MAX_SECTION_FIELD = 20_000;

function capContent(content: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(content)) out[k] = typeof v === "string" ? v.slice(0, MAX_SECTION_FIELD) : v;
  return out;
}

export function updateSectionContent(id: number, content: Record<string, string>): void {
  db().prepare("UPDATE sections SET content = ? WHERE id = ?").run(JSON.stringify(capContent(content)), id);
}

/**
 * Merge a few keys into a section's content, leaving the rest alone.
 *
 * The style rail writes markers and sizes without knowing anything about the
 * creator's words, so it must not hand back a whole content object — that is
 * how an editor open in another tab loses a heading.
 */
export function patchSectionContent(id: number, patch: Record<string, string>): void {
  const d = db();
  // Read and write in ONE transaction, for the same reason patchSiteConfig
  // does: a read-modify-write that another writer can interleave with is a
  // lost update waiting to happen.
  d.transaction(() => {
    const row = d.prepare("SELECT content FROM sections WHERE id = ?").get(id) as { content: string } | undefined;
    if (!row) return;
    const current = parseJson<Record<string, string>>(row.content, {}, `sections.content (section ${id})`);
    d.prepare("UPDATE sections SET content = ? WHERE id = ?").run(
      JSON.stringify(capContent({ ...current, ...patch })),
      id
    );
  })();
}

/**
 * Delete every section of a site in one transaction.
 *
 * The action layer used to loop one DELETE per section with no transaction,
 * where reorderSections right next to it wraps its loop correctly — so a
 * partial failure left the page half-emptied with no way back.
 */
export function deleteAllSections(siteId: number): number {
  return db().prepare("DELETE FROM sections WHERE site_id = ?").run(siteId).changes;
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

/**
 * Add a subscriber, at most once per address per site.
 *
 * DO NOTHING rather than an upsert is deliberate: if the address is already
 * here it either is subscribed (nothing to do) or has opted out, and silently
 * resurrecting an opt-out because someone typed the address into a public form
 * is the one outcome that must not happen. Coming back is a confirmed-opt-in
 * flow, not a side effect of an INSERT.
 */
export function addLead(siteId: number, email: string): void {
  db()
    .prepare("INSERT INTO leads (site_id, email, unsub_token) VALUES (?, ?, ?) ON CONFLICT(site_id, email) DO NOTHING")
    .run(siteId, email.trim().toLowerCase(), randomBytes(16).toString("hex"));
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
  const d = db();
  return d.transaction(() => {
    // Resolve the token to an ADDRESS, then flip every row for it. The token
    // identifies one row, but what the person clicking means is "stop sending
    // to me" — and before the UNIQUE index there could be several rows, each
    // with its own token, so one click stopped one copy and the newsletter
    // kept arriving. The index makes that a single row today; resolving by
    // address keeps it correct for any row that predates it.
    const row = d.prepare("SELECT site_id, email FROM leads WHERE unsub_token = ?").get(token) as
      | { site_id: number; email: string }
      | undefined;
    if (!row) return false;
    d.prepare(
      "UPDATE leads SET unsubscribed_at = datetime('now') WHERE site_id = ? AND email = ? AND unsubscribed_at IS NULL"
    ).run(row.site_id, row.email);
    // Already unsubscribed still counts as success — clicking twice shouldn't scold.
    return true;
  })();
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

/** Referrers past the per-day cap, and anything that isn't a hostname, land here. */
const OTHER_REFERRER = "other";

/**
 * How many DISTINCT referrers we will key rows on for one site in one day.
 * Beyond this everything folds into `other`, which keeps the table bounded
 * without throwing away the shape of a normal day's traffic.
 */
const MAX_REFERRERS_PER_SITE_DAY = 50;

/**
 * Record a view.
 *
 * `referrer` is the host off the request's Referer header — attacker-supplied,
 * on endpoints with no rate limit — and it is part of this table's PRIMARY
 * KEY. Unbounded, a loop with a random referrer per request writes a million
 * permanent rows for one site in one day, and getTopReferrers groups over the
 * whole table synchronously on every Analytics load. So: validate it as a
 * hostname, cap its length, and fold everything past the daily cap into one
 * bucket.
 */
export function recordPageView(siteId: number, referrer: string): void {
  const d = db();
  let host = referrer.trim().toLowerCase().slice(0, 253);
  // Empty is meaningful — it's direct traffic. Anything non-empty has to look
  // like a hostname to get its own row.
  if (host && !/^[a-z0-9][a-z0-9.-]*$/.test(host)) host = OTHER_REFERRER;

  d.transaction(() => {
    const known = d
      .prepare("SELECT 1 FROM page_views WHERE site_id = ? AND day = date('now') AND referrer = ?")
      .get(siteId, host);
    if (!known) {
      const distinct = d
        .prepare("SELECT COUNT(*) AS c FROM page_views WHERE site_id = ? AND day = date('now')")
        .get(siteId) as { c: number };
      if (distinct.c >= MAX_REFERRERS_PER_SITE_DAY) host = OTHER_REFERRER;
    }
    d.prepare(
      `INSERT INTO page_views (site_id, day, referrer, count) VALUES (?, date('now'), ?, 1)
       ON CONFLICT(site_id, day, referrer) DO UPDATE SET count = count + 1`
    ).run(siteId, host);
  })();
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
    // days - 1: the window is inclusive of today, so -30 would be 31 days.
    .all(siteId, `-${days - 1} days`) as Array<{ day: string; views: number }>;
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
  // The www flip is applied here TOO. resolveDomain serves the www-variant of
  // a verified domain, so a claim on example.com already covers
  // www.example.com in practice — but this only looked at the exact string, so
  // the two disagreed about what a claim covers: a second site could claim
  // www.example.com, verify it, and both rows would then answer for the same
  // visitor depending on which the lookup happened to hit first.
  const h = hostname.toLowerCase();
  const flipped = h.startsWith("www.") ? h.slice(4) : `www.${h}`;
  const stmt = db().prepare("SELECT site_id FROM custom_domains WHERE hostname = ? AND verified_at IS NOT NULL");
  const r = (stmt.get(h) ?? stmt.get(flipped)) as { site_id: number } | undefined;
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
/** Stamp a successful TXT check. Doubles as "last re-verified at". */
export function markDomainVerified(siteId: number): void {
  db().prepare("UPDATE custom_domains SET verified_at = datetime('now') WHERE site_id = ?").run(siteId);
}

/**
 * Drop a claim back to unverified.
 *
 * Verification used to be one-shot and permanent: nothing re-read the TXT
 * record and nothing expired a claim, so a creator who verified a domain and
 * later let it lapse kept it forever — the new registrant was told the domain
 * belonged to another Ensemble page before they could reach the step that
 * would prove otherwise, and Caddy kept renewing a certificate for it.
 */
export function clearDomainVerification(siteId: number): void {
  db().prepare("UPDATE custom_domains SET verified_at = NULL WHERE site_id = ?").run(siteId);
}

/** Verified claims not re-checked since `staleDays` ago — the re-check queue. */
export function getDomainsDueRecheck(staleDays: number, limit = 50): CustomDomain[] {
  const rows = db()
    .prepare(
      `SELECT * FROM custom_domains
        WHERE verified_at IS NOT NULL AND verified_at < datetime('now', ?)
        ORDER BY verified_at LIMIT ?`
    )
    .all(`-${staleDays} days`, limit) as DomainRow[];
  return rows.map(toDomain);
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

    // Snapshot the creator's edits before anything is deleted. A report is
    // authorised by a token that ships in public HTML, so "someone replaced
    // your whole inventory" has to be recoverable without trusting whoever
    // sent the report. Only edited rows are worth keeping — the originals are
    // rediscovered on the next report anyway.
    const editedRows = previous.filter((p) => p.edited !== null);
    if (editedRows.length > 0) {
      d.prepare("INSERT INTO content_snapshots (site_id, payload, edited_count) VALUES (?, ?, ?)").run(
        siteId,
        JSON.stringify(
          editedRows.map((p) => ({ selector: p.selector, kind: p.kind, original: p.original, edited: p.edited }))
        ),
        editedRows.length
      );
      // Keep the last few only; this is an undo, not a history.
      d.prepare(
        `DELETE FROM content_snapshots WHERE site_id = ?
          AND id NOT IN (SELECT id FROM content_snapshots WHERE site_id = ? ORDER BY id DESC LIMIT ?)`
      ).run(siteId, siteId, MAX_CONTENT_SNAPSHOTS);
    }

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

/** How many undo points a site keeps. */
const MAX_CONTENT_SNAPSHOTS = 5;

export interface ContentSnapshot {
  id: number;
  editedCount: number;
  takenAt: string;
}

/** Undo points for a site's paired-site edits, newest first. */
export function getContentSnapshots(siteId: number): ContentSnapshot[] {
  const rows = db()
    .prepare("SELECT id, edited_count, taken_at FROM content_snapshots WHERE site_id = ? ORDER BY id DESC")
    .all(siteId) as Array<{ id: number; edited_count: number; taken_at: string }>;
  return rows.map((r) => ({ id: r.id, editedCount: r.edited_count, takenAt: r.taken_at }));
}

/**
 * Re-apply a snapshot's edits onto the CURRENT inventory.
 *
 * Matched the same way replaceSiteContent carries edits across — exact key
 * first, then content alone — so an undo survives a selector change. Returns
 * how many edits were restored.
 */
export function restoreContentSnapshot(siteId: number, snapshotId: number): number {
  const d = db();
  return d.transaction(() => {
    const row = d
      .prepare("SELECT payload FROM content_snapshots WHERE id = ? AND site_id = ?")
      .get(snapshotId, siteId) as { payload: string } | undefined;
    if (!row) return 0;
    const saved = parseJson<Array<{ selector: string; kind: string; original: string; edited: string }>>(
      row.payload,
      [],
      `content_snapshots.payload (snapshot ${snapshotId})`
    );

    const current = d.prepare("SELECT * FROM site_content WHERE site_id = ?").all(siteId) as ContentRow[];
    const byExact = new Map<string, number>();
    const byContent = new Map<string, number | null>();
    for (const c of current) {
      byExact.set(`${c.selector}\x00${c.kind}\x00${c.original}`, c.id);
      const ck = `${c.kind}\x00${c.original}`;
      byContent.set(ck, byContent.has(ck) ? null : c.id);
    }

    const update = d.prepare("UPDATE site_content SET edited = ? WHERE id = ? AND site_id = ?");
    let restored = 0;
    for (const s of saved) {
      const id = byExact.get(`${s.selector}\x00${s.kind}\x00${s.original}`) ?? byContent.get(`${s.kind}\x00${s.original}`);
      if (typeof id === "number") {
        update.run(s.edited, id, siteId);
        restored++;
      }
    }
    return restored;
  })();
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

/**
 * Disconnect a platform and take its history with it.
 *
 * follower_counts is keyed on site, not account, so the rows used to survive —
 * and because the follower series carries the last reading forward with no
 * expiry, a disconnected TikTok's 400k kept contributing to every later day's
 * total. logFollowerCounts only iterates CONNECTED accounts, so no new reading
 * could ever correct it, and the only manual removal path renders when the
 * viewed date equals the reading's date, so the creator had to already know
 * which date to go to.
 */
export function deleteSocialAccount(siteId: number, platform: string): void {
  const d = db();
  d.transaction(() => {
    d.prepare("DELETE FROM social_accounts WHERE site_id = ? AND platform = ?").run(siteId, platform);
    d.prepare("DELETE FROM follower_counts WHERE site_id = ? AND platform = ?").run(siteId, platform);
    d.prepare("DELETE FROM social_stats WHERE site_id = ? AND platform = ?").run(siteId, platform);
  })();
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
