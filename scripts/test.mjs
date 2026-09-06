#!/usr/bin/env node
/**
 * Test runner.
 *
 * No new dependencies: node:test ships with Node, and the only thing standing
 * between it and this codebase is TypeScript. So this compiles src/lib to
 * CommonJS in a throwaway directory, stands up an isolated working directory
 * with its own data/ (db.ts resolves its file from process.cwd(), and the
 * tests must never touch the real one), and runs node --test against it.
 *
 *   npm test
 *
 * Tests require modules through TEST_LIB, which points at the compiled output.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.join(root, ".test-build");
const sandbox = mkdtempSync(path.join(tmpdir(), "ensemble-test-"));

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  return res.status ?? 1;
}

rmSync(build, { recursive: true, force: true });

// server-only is a build-time marker with no runtime behaviour; the stub in
// tests/stubs lets the compiled modules load outside Next.
const compiled = run(
  "npx",
  [
    "tsc", "src/lib/billing.ts", "src/lib/db.ts", "src/lib/plans.ts", "src/lib/sections.ts",
    "src/lib/followers.ts", "src/lib/ratelimit.ts", "src/lib/siteurl.ts", "src/lib/live.ts", "src/lib/login-providers.ts",
    "--outDir", build,
    "--module", "commonjs", "--target", "es2022",
    "--esModuleInterop", "--skipLibCheck", "--moduleResolution", "node",
    "--resolveJsonModule",
  ],
  { cwd: root }
);
if (compiled !== 0) {
  console.error("✗ Test sources failed to compile.");
  process.exit(compiled);
}

mkdirSync(path.join(sandbox, "data"), { recursive: true });

// --test-concurrency=1: every test file shares one SQLite file, and node's
// default is to run files in PARALLEL processes. Two writers on one database
// is a lock fight that says nothing about the code under test.
const status = run("node", ["--test", "--test-concurrency=1", path.join(root, "tests")], {
  cwd: sandbox,
  env: {
    ...process.env,
    TEST_LIB: build,
    NODE_PATH: [path.join(root, "tests", "stubs"), path.join(root, "node_modules")].join(path.delimiter),
    NODE_ENV: "test",
  },
});

rmSync(sandbox, { recursive: true, force: true });
process.exit(status);
