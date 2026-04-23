/**
 * QuestDB Migration Runner
 *
 * Discovers ordered .sql files from the migrations/ directory,
 * executes each one against QuestDB via the HTTP exec endpoint.
 *
 * - Idempotent: all SQL uses CREATE TABLE IF NOT EXISTS
 * - Ordered by filename (001_, 002_, …)
 * - Silently skips migrations that fail with "table already exists" (QuestDB behavior)
 * - Runs at application startup only, NOT inside repositories or request handlers
 */

import { Effect } from "effect";
import { join, dirname } from "path";
import { readdirSync, readFileSync } from "fs";
import { QuestDBClient, command } from "../client";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = __dirname;

/** Read all .sql files in order from the migrations directory. */
function loadMigrationFiles(): Array<{ name: string; sql: string }> {
  let files: string[];
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort(); // lexicographic — 001_ < 002_ < ...
  } catch {
    // Directory doesn't exist (e.g. in certain test environments)
    return [];
  }

  return files.map((name) => ({
    name,
    sql: readFileSync(join(MIGRATIONS_DIR, name), "utf-8").trim(),
  }));
}

/**
 * Run all QuestDB migrations in order.
 * Each statement is executed individually; errors are logged but do not abort
 * subsequent migrations (QuestDB already handles IF NOT EXISTS idempotently).
 */
export function runQuestDBMigrations(): Effect.Effect<void, never, QuestDBClient> {
  return Effect.gen(function* () {
    const migrations = loadMigrationFiles();

    if (migrations.length === 0) {
      yield* Effect.logInfo("[QuestDB] No migration files found — skipping");
      return;
    }

    yield* Effect.logInfo(`[QuestDB] Running ${migrations.length} migration(s)…`);

    for (const { name, sql } of migrations) {
      yield* command(sql).pipe(
        Effect.tap(() => Effect.logInfo(`[QuestDB] Applied migration: ${name}`)),
        Effect.catchAll((err) =>
          Effect.logWarning(
            `[QuestDB] Migration ${name} failed (may be harmless if table already exists): ${err.message}`
          )
        )
      );
    }

    yield* Effect.logInfo("[QuestDB] Migrations complete");
  });
}
