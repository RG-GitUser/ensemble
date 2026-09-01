#!/usr/bin/env node
/**
 * Rotate the admin account's password.
 *
 * The seeded default is written in source that lives in a public repo, so any
 * deployment created without ADMIN_PASSWORD set is reachable by anyone who
 * reads it. Setting ADMIN_PASSWORD afterwards does nothing, because seedAdmin
 * returns early once the account exists, and the app has no password-change
 * screen. This script is the way to fix an already-seeded install.
 *
 * Run it on the machine holding the database, from the app directory:
 *
 *   read -rs NEWPW && printf '%s' "$NEWPW" | node scripts/set-admin-password.mjs
 *
 * The password arrives on stdin so it stays out of shell history and out of
 * the process list. Every existing session for the account is dropped too, so
 * anyone already signed in with the old password gets signed out.
 */

import Database from "better-sqlite3";
import { randomBytes, scryptSync } from "node:crypto";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "app.db");
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "rileyg0035@gmail.com").toLowerCase();

/** Matches hashPassword in src/lib/auth.ts. Keep the two in step. */
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (buf += chunk));
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", reject);
  });
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const password = (await readStdin()).replace(/\r?\n$/, "");

if (!password) fail("No password on stdin. See the comment at the top of this file for the command.");
if (password.length < 12) fail(`Password is ${password.length} characters. Use at least 12.`);
if (/^admin/i.test(password)) fail("That looks like the seeded default. Pick something else.");

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

const admin = db.prepare("SELECT id FROM users WHERE email = ?").get(ADMIN_EMAIL);
if (!admin) {
  fail(`No account found for ${ADMIN_EMAIL} in ${DB_PATH}. Check ADMIN_EMAIL and the working directory.`);
}

db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), admin.id);
const dropped = db.prepare("DELETE FROM sessions WHERE user_id = ?").run(admin.id).changes;

console.log(`✓ Password updated for ${ADMIN_EMAIL}`);
console.log(`✓ ${dropped} existing session(s) signed out`);
console.log("Sign in again at /login to confirm before you close this shell.");
