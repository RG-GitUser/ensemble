#!/usr/bin/env node
/**
 * Mint a local session cookie, for looking at the dashboard during development.
 *
 * The dashboard is behind a login, which makes the screens that are hardest to
 * get right — the Design preview, the section cards, anything that only exists
 * once you are signed in — also the hardest to check. The alternatives are all
 * worse than this: typing a real password into a browser you are automating,
 * or building a back door into the app itself.
 *
 * This does neither. It writes a session row straight into the local SQLite
 * file and prints the cookie, exactly as logging in would have. No password is
 * involved because no password is checked: holding the database file is
 * already total authority over it.
 *
 * That is also precisely why it is refused anywhere that is not local. The
 * guards below are deliberately blunt.
 *
 *   node scripts/dev-login.mjs                       # dev-fixture@localhost
 *   node scripts/dev-login.mjs demo@ensemble.app     # some other local account
 *
 * Then, in the browser's console on http://localhost:3000:
 *   document.cookie = "<the line it prints>"
 */

import Database from "better-sqlite3";
import { randomBytes } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.join(process.cwd(), "data", "app.db");
const DEFAULT_EMAIL = "dev-fixture@localhost";
const SESSION_DAYS = 30;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// Three independent reasons to refuse, because any one of them alone is a
// thing somebody could plausibly get wrong on a server.
if (process.env.NODE_ENV === "production") {
  fail("NODE_ENV=production. This is a development-only tool.");
}
if (process.env.APP_URL && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(process.env.APP_URL)) {
  fail(`APP_URL is ${process.env.APP_URL}, which is not local. Refusing to mint a session.`);
}
if (fs.existsSync("/srv/ensemble")) {
  fail("/srv/ensemble exists — this looks like the deployed droplet, not a dev machine.");
}

if (!fs.existsSync(DB_PATH)) {
  fail(`No database at ${DB_PATH}. Start the dev server once to create it, or check the working directory.`);
}

const email = (process.argv[2] || DEFAULT_EMAIL).toLowerCase();
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

const user = db.prepare("SELECT id, email, name FROM users WHERE email = ?").get(email);
if (!user) {
  const known = db.prepare("SELECT email FROM users ORDER BY id").all().map((r) => r.email);
  fail(`No local account for ${email}.\n  Accounts in this database: ${known.join(", ")}`);
}

const token = randomBytes(32).toString("hex");
const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, user.id, expiresAt);

console.log(`✓ Session for ${user.email} (${user.name}), good for ${SESSION_DAYS} days.`);
console.log("");
console.log("Paste into the browser console on http://localhost:3000 :");
console.log("");
console.log(`  document.cookie = "fs_session=${token}; path=/; max-age=${SESSION_DAYS * 24 * 60 * 60}"`);
console.log("");
console.log("Or with curl:");
console.log("");
console.log(`  curl -s -b "fs_session=${token}" http://localhost:3000/dashboard`);
console.log("");
console.log("Sign it out again with:  DELETE FROM sessions WHERE token = '<token>';");
