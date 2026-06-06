import { Effect } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { SqlClient } from "effect/unstable/sql/SqlClient";
import type { SqlError } from "effect/unstable/sql/SqlError";

const TABLE_NAME = "auth_migrations";

interface SqlMigrationFile {
  readonly id: number;
  readonly name: string;
  readonly fileName: string;
}

const loadSqlMigrations = (
  fs: FileSystem,
  sqlDir: string
): Effect.Effect<ReadonlyArray<SqlMigrationFile>, never> =>
  Effect.gen(function* () {
    const files = yield* Effect.catch(fs.readDirectory(sqlDir), () =>
      Effect.succeed<ReadonlyArray<string>>([])
    );

    const migrations: Array<SqlMigrationFile> = [];

    for (const file of [...files].sort()) {
      const match = file.match(/^(\d+)_(.+)\.up\.sql$/);
      if (match) {
        migrations.push({
          id: Number(match[1]),
          name: match[2],
          fileName: file,
        });
      }
    }

    return migrations.sort((a, b) => a.id - b.id);
  });

// Compatible with PgMigrator schema

const ensureMigrationsTable = (sql: SqlClient): Effect.Effect<void, SqlError> =>
  Effect.gen(function* () {
    yield* sql.unsafe(`CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      migration_id INTEGER PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name TEXT NOT NULL
    )`);
  });

const getAppliedMigrationIds = (sql: SqlClient): Effect.Effect<ReadonlySet<number>, SqlError> =>
  Effect.gen(function* () {
    const rows = yield* sql.unsafe<{ migration_id: number }>(
      `SELECT migration_id FROM ${TABLE_NAME} ORDER BY migration_id`
    );
    return new Set(rows.map((r) => r.migration_id));
  });

export const runSqlMigrations = Effect.gen(function* () {
  const sql = yield* SqlClient;
  const fs = yield* FileSystem;
  const path = yield* Path;

  const moduleDir = new URL(".", import.meta.url).pathname;
  const sqlDir = path.resolve(moduleDir, "sql");

  const available: ReadonlyArray<SqlMigrationFile> = yield* loadSqlMigrations(fs, sqlDir);

  if (available.length === 0) {
    yield* Effect.logInfo("No SQL migration files found");
    return [];
  }

  yield* ensureMigrationsTable(sql);
  yield* Effect.logDebug("Migration tracking table ensured");

  const appliedIds: ReadonlySet<number> = yield* getAppliedMigrationIds(sql);
  const pending = available.filter((m) => !appliedIds.has(m.id));

  if (pending.length === 0) {
    yield* Effect.logInfo("All SQL migrations are up to date");
    return [];
  }

  const applied: Array<[number, string]> = [];

  for (const migration of pending) {
    yield* Effect.logInfo(`Running SQL migration: ${migration.id}_${migration.name}`);

    const filePath = path.resolve(sqlDir, migration.fileName);
    const content = yield* fs.readFileString(filePath);

    yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql.unsafe(content);
        yield* sql.unsafe(`INSERT INTO ${TABLE_NAME} (migration_id, name) VALUES ($1, $2)`, [
          migration.id,
          migration.name,
        ]);
      })
    );

    applied.push([migration.id, migration.name]);

    yield* Effect.logInfo(`SQL migration applied: ${migration.id}_${migration.name}`);
  }

  return applied;
});
