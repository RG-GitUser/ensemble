import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomBytes, scryptSync } from "crypto";
import type {
  ChatMessage,
  Connection,
  ContentItem,
  CustomDomain,
  DailyViews,
  Lead,
  QuoteRequest,
  ReferrerViews,
  Section,
  Site,
  SocialAccount,
  SocialAccountAuth,
  SocialPost,
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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      body TEXT NOT NULL,
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
    CREATE TABLE IF NOT EXISTS connections (
      site_id INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_scraped TEXT,
      last_seen TEXT,
      seen_host TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS custom_domains (
      site_id INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
      hostname TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT
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
    CREATE TABLE IF NOT EXISTS social_post_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      detail TEXT NOT NULL DEFAULT ''
    );
  `);

  // Publisher-pipeline columns arrived after the social tables shipped.
  const saCols = new Set((db.prepare("PRAGMA table_info(social_accounts)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!saCols.has("auth_kind")) db.exec("ALTER TABLE social_accounts ADD COLUMN auth_kind TEXT NOT NULL DEFAULT 'handle'");
  if (!saCols.has("secret")) db.exec("ALTER TABLE social_accounts ADD COLUMN secret TEXT NOT NULL DEFAULT ''");
  if (!saCols.has("refresh_token")) db.exec("ALTER TABLE social_accounts ADD COLUMN refresh_token TEXT NOT NULL DEFAULT ''");
  if (!saCols.has("expires_at")) db.exec("ALTER TABLE social_accounts ADD COLUMN expires_at TEXT");
  if (!saCols.has("external_id")) db.exec("ALTER TABLE social_accounts ADD COLUMN external_id TEXT NOT NULL DEFAULT ''");
  const tCols = new Set((db.prepare("PRAGMA table_info(social_post_targets)").all() as Array<{ name: string }>).map((c) => c.name));
  if (!tCols.has("detail")) db.exec("ALTER TABLE social_post_targets ADD COLUMN detail TEXT NOT NULL DEFAULT ''");
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

  return db;
}

function newEmbedToken(): string {
  return randomBytes(12).toString("hex");
}

// A syntactically valid salt:hash that no real password can produce, so the
// demo account can never be logged into.
const DEMO_LOCKED_HASH = "0".repeat(32) + ":" + "0".repeat(128);

/** Seed the public example page at /s/demo (idempotent). */
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
    .prepare("INSERT INTO sites (user_id, slug, plan, published, config, embed_token) VALUES (?, 'demo', 'enterprise', 1, ?, ?)")
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
 * Seed the admin account so /admin is reachable out of the box (idempotent).
 * Email matches ADMIN_EMAIL in auth.ts; password defaults to "admin1234"
 * (override with ADMIN_PASSWORD before first run).
 */
function seedAdmin(d: Database.Database): void {
  const email = (process.env.ADMIN_EMAIL || "j@cub.pw").toLowerCase();
  if (d.prepare("SELECT id FROM users WHERE email = ?").get(email)) return;

  const password = process.env.ADMIN_PASSWORD || "admin1234";
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  const info = d
    .prepare("INSERT INTO users (email, password_hash, name, business_name) VALUES (?, ?, ?, ?)")
    .run(email, `${salt}:${hash}`, "Site Admin", "Ensemble HQ");
  const userId = Number(info.lastInsertRowid);

  const config = JSON.stringify({ themeColor: "#8b5cf6", tagline: "" });
  const siteInfo = d
    .prepare("INSERT INTO sites (user_id, slug, plan, published, config, embed_token) VALUES (?, 'hq', 'enterprise', 0, ?, ?)")
    .run(userId, config, newEmbedToken());
  const siteId = Number(siteInfo.lastInsertRowid);
  d.prepare("INSERT INTO sections (site_id, type, position, content) VALUES (?, 'hero', 1, ?)").run(
    siteId,
    JSON.stringify({
      heading: "Ensemble HQ",
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
}
interface SiteRow {
  id: number;
  user_id: number;
  slug: string;
  plan: string;
  published: number;
  config: string;
  embed_token: string | null;
  created_at: string;
}
interface SectionRow {
  id: number;
  site_id: number;
  type: string;
  position: number;
  content: string;
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
  created_at: string;
}

function toUser(r: UserRow): User {
  return { id: r.id, email: r.email, name: r.name, businessName: r.business_name, createdAt: r.created_at };
}
function toSite(r: SiteRow): Site {
  return {
    id: r.id,
    userId: r.user_id,
    slug: r.slug,
    plan: (r.plan as Site["plan"]) || "basic",
    published: r.published === 1,
    config: {
      themeColor: "#8b5cf6",
      bgColor: "#0a0812",
      cardColor: "rgba(255,255,255,0.05)",
      tagline: "",
      ...JSON.parse(r.config || "{}"),
    },
    embedToken: r.embed_token ?? "",
    createdAt: r.created_at,
  };
}
function toSection(r: SectionRow): Section {
  return { id: r.id, siteId: r.site_id, type: r.type, position: r.position, content: JSON.parse(r.content || "{}") };
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
  return { id: r.id, siteId: r.site_id, email: r.email, createdAt: r.created_at };
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

export function updateSectionContent(id: number, content: Record<string, string>): void {
  db().prepare("UPDATE sections SET content = ? WHERE id = ?").run(JSON.stringify(content), id);
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
  db().prepare("INSERT INTO leads (site_id, email) VALUES (?, ?)").run(siteId, email);
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

/* ---------- chat messages ---------- */

interface ChatRow {
  id: number;
  site_id: number;
  author: string;
  body: string;
  created_at: string;
}

function toChatMessage(r: ChatRow): ChatMessage {
  return { id: r.id, siteId: r.site_id, author: r.author, body: r.body, createdAt: r.created_at };
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

export function addChatMessage(siteId: number, author: string, body: string): ChatMessage {
  const info = db()
    .prepare("INSERT INTO chat_messages (site_id, author, body) VALUES (?, ?, ?)")
    .run(siteId, author, body);
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

/* ---------- website connections ---------- */

interface ConnectionRow {
  site_id: number;
  url: string;
  enabled: number;
  last_scraped: string | null;
  last_seen: string | null;
  seen_host: string;
}

function toConnection(r: ConnectionRow): Connection {
  return {
    siteId: r.site_id,
    url: r.url,
    enabled: r.enabled === 1,
    lastScraped: r.last_scraped,
    lastSeen: r.last_seen,
    seenHost: r.seen_host,
  };
}

export function getConnection(siteId: number): Connection | null {
  const r = db().prepare("SELECT * FROM connections WHERE site_id = ?").get(siteId) as ConnectionRow | undefined;
  return r ? toConnection(r) : null;
}

export function upsertConnection(siteId: number, url: string): void {
  db()
    .prepare(
      `INSERT INTO connections (site_id, url, enabled, last_scraped) VALUES (?, ?, 1, datetime('now'))
       ON CONFLICT(site_id) DO UPDATE SET url = excluded.url, last_scraped = datetime('now')`
    )
    .run(siteId, url);
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

/* ---------- custom domains ---------- */

interface DomainRow {
  site_id: number;
  hostname: string;
  created_at: string;
  last_seen: string | null;
}

function toDomain(r: DomainRow): CustomDomain {
  return { siteId: r.site_id, hostname: r.hostname, createdAt: r.created_at, lastSeen: r.last_seen };
}

export function getDomainBySite(siteId: number): CustomDomain | null {
  const r = db().prepare("SELECT * FROM custom_domains WHERE site_id = ?").get(siteId) as DomainRow | undefined;
  return r ? toDomain(r) : null;
}

/** Exact hostname match first, then the www-flipped variant, so one record covers both. */
export function resolveDomain(hostname: string): CustomDomain | null {
  const h = hostname.toLowerCase();
  const flipped = h.startsWith("www.") ? h.slice(4) : `www.${h}`;
  const byHost = db().prepare("SELECT * FROM custom_domains WHERE hostname = ?");
  const r = (byHost.get(h) ?? byHost.get(flipped)) as DomainRow | undefined;
  return r ? toDomain(r) : null;
}

export function domainTaken(hostname: string, excludeSiteId?: number): boolean {
  const r = db().prepare("SELECT site_id FROM custom_domains WHERE hostname = ?").get(hostname) as
    | { site_id: number }
    | undefined;
  return !!r && r.site_id !== excludeSiteId;
}

/** Point `hostname` at this site (one domain per site — replaces any previous one). */
export function setCustomDomain(siteId: number, hostname: string): void {
  db()
    .prepare(
      `INSERT INTO custom_domains (site_id, hostname) VALUES (?, ?)
       ON CONFLICT(site_id) DO UPDATE SET hostname = excluded.hostname, last_seen = NULL, created_at = datetime('now')`
    )
    .run(siteId, hostname);
}

export function deleteCustomDomain(siteId: number): void {
  db().prepare("DELETE FROM custom_domains WHERE site_id = ?").run(siteId);
}

/** A request for this domain reached us — DNS and the proxy chain work. */
export function touchDomain(siteId: number): void {
  db().prepare("UPDATE custom_domains SET last_seen = datetime('now') WHERE site_id = ?").run(siteId);
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
    const carried = new Map<string, string>();
    for (const p of previous) {
      if (p.edited !== null) carried.set(`${p.selector} ${p.kind} ${p.original}`, p.edited);
    }
    d.prepare("DELETE FROM site_content WHERE site_id = ?").run(siteId);
    const insert = d.prepare(
      "INSERT INTO site_content (site_id, selector, kind, original, edited, position) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const it of items) {
      insert.run(siteId, it.selector, it.kind, it.original, carried.get(`${it.selector} ${it.kind} ${it.original}`) ?? null, it.position);
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
