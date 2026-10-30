#!/usr/bin/env bun
// Greps for constructs the linters cannot express. Every hit must be either
// fixed, allowlisted inline, or recorded in the checked-in baseline.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = fileURLToPath(new URL("../packages/api", import.meta.url));
const root = process.env.BANNED_CONSTRUCTS_ROOT ?? defaultRoot;
const baselinePath = fileURLToPath(new URL("./banned-constructs.baseline.txt", import.meta.url));

/** @param {string} path */
const isTest = (path) => path.includes("/__tests__/") || path.endsWith(".test.ts");

/** @type {Array<{ id: string, pattern: RegExp, allowed: (path: string) => boolean }>} */
const RULES = [
  {
    id: "no-run-effect",
    // Tests exist to run effects; only production entry points may.
    pattern: /Effect\.run(?:Promise|Sync|Fork|SyncWith|PromiseWith)\s*\(/,
    allowed: (path) => path === "main.ts" || path.startsWith("app/") || isTest(path),
  },
  {
    id: "no-console",
    pattern: /console\./,
    allowed: (path) => path.startsWith("platform/"),
  },
  {
    id: "no-process-env",
    pattern: /process\.env/,
    allowed: (path) => path === "main.ts" || path === "platform/config.ts",
  },
  {
    id: "no-ambient-clock",
    pattern: /\bDate\.now\(\)|new Date\(\)/,
    allowed: (path) => path.startsWith("platform/") || isTest(path),
  },
];

/** @param {string} dir @returns {string[]} */
const walk = (dir) => {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "dist") continue;
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry.endsWith(".ts")) files.push(full);
  }
  return files;
};

/** @param {string[]} lines @param {number} index @param {string} id */
const allowlisted = (lines, index, id) =>
  lines[index].includes(`lint-allow: ${id}`) ||
  (index > 0 && lines[index - 1].includes(`lint-allow: ${id}`));

/** @returns {string[]} */
const scan = () => {
  /** @type {string[]} */
  const hits = [];
  for (const file of walk(root)) {
    const path = relative(root, file).split("\\").join("/");
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        if (rule.allowed(path)) continue;
        if (!rule.pattern.test(line)) continue;
        if (allowlisted(lines, index, rule.id)) continue;
        hits.push(`${path}:${index + 1} ${rule.id}`);
      }
    });
  }
  return hits;
};

const hits = scan();

const baseline = readFileSync(baselinePath, "utf8")
  .split("\n")
  .filter((line) => line !== "");
const baselined = new Set(baseline);
const fresh = hits.filter((hit) => !baselined.has(hit));

for (const hit of fresh) console.error(`banned construct: ${hit}`);

const allowedCount = hits.length - fresh.length;
console.log(`${fresh.length} new violations, ${allowedCount} baselined`);
process.exit(fresh.length === 0 ? 0 : 1);
