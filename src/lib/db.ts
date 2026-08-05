import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Lead, QuoteRequest, Section, Site, User } from "./types";

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
  `);
  return db;
}

// A syntactically valid salt:hash that no real password can produce, so the
// demo account can never be logged into.
const DEMO_LOCKED_HASH = "0".repeat(32) + ":" + "0".repeat(128);

/** Seed the public example page at /s/demo (idempotent). */
function seedDemo(d: Database.Database): void {
  if (d.prepare("SELECT id FROM sites WHERE slug = 'demo'").get()) return;

  let userId: number;
  const existing = d.prepare("SELECT id FROM users WHERE email = ?").get("demo@socialconstruct.app") as
    | { id: number }
    | undefined;
  if (existing) {
    userId = existing.id;
  } else {
    const info = d
      .prepare("INSERT INTO users (email, password_hash, name, business_name) VALUES (?, ?, ?, ?)")
      .run("demo@socialconstruct.app", DEMO_LOCKED_HASH, "Nova Rae", "Nova Rae");
    userId = Number(info.lastInsertRowid);
  }

  const config = JSON.stringify({
    themeColor: "#8b5cf6",
    tagline: "This is a live example page — yours takes about 10 minutes.",
    newsletterEnabled: true,
    chatroomEnabled: true,
  });
  const siteInfo = d
    .prepare("INSERT INTO sites (user_id, slug, plan, published, config) VALUES (?, 'demo', 'enterprise', 1, ?)")
    .run(userId, config);
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

// Lazily opened and cached across dev hot-reloads, so importing this module
// (e.g. during build-time page analysis) doesn't touch the database file.
const g = globalThis as unknown as { __appDb?: Database.Database; __appDbSeeded?: boolean };
function db(): Database.Database {
  const d = (g.__appDb ??= createDb());
  if (!g.__appDbSeeded) {
    seedDemo(d);
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
    config: { themeColor: "#8b5cf6", tagline: "", ...JSON.parse(r.config || "{}") },
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
    .prepare("INSERT INTO sites (user_id, slug, plan, config) VALUES (?, ?, ?, ?)")
    .run(userId, slug, plan, JSON.stringify(config));
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
  details: string
): QuoteRequest {
  const info = db()
    .prepare(
      "INSERT INTO quote_requests (user_id, name, business_name, email, website_url, details) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(userId, name, businessName, email, websiteUrl, details);
  const r = db().prepare("SELECT * FROM quote_requests WHERE id = ?").get(Number(info.lastInsertRowid)) as QuoteRow;
  return toQuote(r);
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
