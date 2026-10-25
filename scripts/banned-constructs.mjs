#!/usr/bin/env bun
// Greps for constructs the linters cannot express. Every hit must be either
// fixed, allowlisted inline, or recorded in the checked-in baseline.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = fileURLToPath(new URL("../packages/api", import.meta.url));
const root = process.env.BANNED_CONSTRUCTS_ROOT ?? defaultRoot;
const baselinePath = fileURLToPath(new URL("./banned-constructs.baseline.txt", import.meta.url));
const writeBaseline = process.argv.includes("--write-baseline");

const isTest = (path) => path.includes("/__tests__/") || path.endsWith(".test.ts");

const RULES = [
  {
    id: "no-run-effect",
    pattern: /Effect\.run(?:Promise|Sync|Fork|SyncWith|PromiseWith)\s*\(/,
    allowed: (path) => path === "main.ts" || path.startsWith("app/"),
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

const allowlisted = (lines, index, id) =>
  lines[index].includes(`lint-allow: ${id}`) ||
  (index > 0 && lines[index - 1].includes(`lint-allow: ${id}`));

const scan = () => {
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

if (writeBaseline) {
  writeFileSync(baselinePath, `${hits.join("\n")}\n`);
  console.log(`baseline written: ${hits.length} entries -> ${baselinePath}`);
  process.exit(0);
}

const baseline = readFileSync(baselinePath, "utf8")
  .split("\n")
  .filter((line) => line !== "");
const baselined = new Set(baseline);
const fresh = hits.filter((hit) => !baselined.has(hit));

for (const hit of fresh) console.error(`banned construct: ${hit}`);

const allowedCount = hits.length - fresh.length;
console.log(`${fresh.length} new violations, ${allowedCount} baselined`);
process.exit(fresh.length === 0 ? 0 : 1);
