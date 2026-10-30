#!/usr/bin/env bun
// Inline suppressions are banned outright: they hide a defect at the exact line
// that caused it. Fix the code, or change a reviewed config file instead.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const TOKENS = [
  "oxlint-disable",
  "eslint-disable",
  "@ts-expect-error",
  "@ts-ignore",
  "@ts-nocheck",
  "lint-allow:",
  "--no-verify",
];

// Hook files carry no extension, so the extension filter below cannot see them.
// Their whole job is to block, so any escape hatch written into one is a bypass.
const HOOK_TOKENS = ["--no-verify", "HUSKY=0", "HUSKY", "set +e", "|| true"];
const HOOK_EXIT_ZERO = /^\s*exit\s+0\s*$/;

// The scanner and the rule table must spell the tokens to match them.
const SKIPPED_FILES = new Set(["scripts/no-bypass.mjs", "scripts/banned-constructs.mjs"]);
const SKIPPED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);
const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".mjs",
  ".sh",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

/** @returns {string[]} */
const trackedFiles = () =>
  execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter((path) => path !== "");

/** @param {string} path */
const isScannable = (path) =>
  !SKIPPED_FILES.has(path) &&
  !path.split("/").some((segment) => SKIPPED_DIRS.has(segment)) &&
  SOURCE_EXTENSIONS.has(extname(path));

/** @param {string} path */
const isHook = (path) =>
  path.startsWith(".husky/") && !path.startsWith(".husky/_/") && path.split("/").length === 2;

/** @returns {string[]} */
const scan = () => {
  /** @type {string[]} */
  const hits = [];
  for (const file of trackedFiles()) {
    const hook = isHook(file);
    if (!hook && !isScannable(file)) continue;
    const lines = readFileSync(join(root, file), "utf8").split("\n");
    lines.forEach((line, index) => {
      if (hook) {
        for (const token of HOOK_TOKENS) {
          if (line.includes(token)) hits.push(`${file}:${index + 1} ${token}`);
        }
        if (HOOK_EXIT_ZERO.test(line)) hits.push(`${file}:${index + 1} exit 0`);
        return;
      }
      for (const token of TOKENS) {
        if (line.includes(token)) hits.push(`${file}:${index + 1} ${token}`);
      }
    });
  }
  return hits;
};

const hits = scan();
for (const hit of hits) console.error(`inline bypass: ${hit}`);
console.log(`${hits.length} inline bypasses, ${relative(process.cwd(), root) || "."} scanned`);
process.exit(hits.length === 0 ? 0 : 1);
