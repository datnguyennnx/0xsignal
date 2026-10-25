import { Array as A, Effect, Order } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { SqlClient } from "effect/sql/SqlClient";
import { SqlError, UnknownError } from "effect/sql/SqlError";
import { PostgresConnectionPool } from "../db/postgres";

const TABLE_NAME = "auth_migrations";

interface SqlMigrationFile {
  readonly id: number;
  readonly name: string;
  readonly fileName: string;
}

type PoolClient = import("pg").PoolClient;

const loadSqlMigrations = (
  fs: FileSystem,
  sqlDir: string,
): Effect.Effect<ReadonlyArray<SqlMigrationFile>> =>
  Effect.gen(function* () {
    const files = yield* fs
      .readDirectory(sqlDir)
      .pipe(Effect.catch(() => Effect.succeed<ReadonlyArray<string>>([])));

    const migrations: Array<SqlMigrationFile> = [];

    for (const file of files) {
      const match = file.match(/^(\d+)_(.+)\.up\.sql$/);
      if (match) {
        migrations.push({
          id: Number(match[1]),
          name: match[2],
          fileName: file,
        });
      }
    }

    return A.sortWith<ReadonlyArray<SqlMigrationFile>, number>(
      (m) => m.id,
      Order.Number,
    )(migrations);
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
      `SELECT migration_id FROM ${TABLE_NAME} ORDER BY migration_id`,
    );
    return new Set(rows.map((r) => r.migration_id));
  });

const toSqlError = (cause: unknown, message: string): SqlError =>
  new SqlError({ reason: new UnknownError({ cause, message }) });

// One file is one transaction on one connection: a statement that fails aborts
// the file and the ledger row with it.
const applyFile = (
  client: PoolClient,
  content: string,
  migration: SqlMigrationFile,
): Effect.Effect<void, SqlError> =>
  Effect.tryPromise({
    try: async () => {
      await client.query("BEGIN");
      try {
        // A parameterless string makes node-postgres use the simple query
        // protocol, the only one that accepts several statements in one file.
        await client.query(content);
        await client.query(`INSERT INTO ${TABLE_NAME} (migration_id, name) VALUES ($1, $2)`, [
          migration.id,
          migration.name,
        ]);
        await client.query("COMMIT");
      } catch (cause) {
        await client.query("ROLLBACK");
        throw cause;
      }
    },
    catch: (cause) => toSqlError(cause, `Migration ${migration.fileName} failed`),
  });

export const runSqlMigrationsFrom = (sqlDir: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    const pool = yield* PostgresConnectionPool;
    const fs = yield* FileSystem;
    const path = yield* Path;

    if (pool === null) {
      return yield* toSqlError(undefined, "Auth SQL migrations need a Postgres pool");
    }

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

      yield* Effect.scoped(
        Effect.gen(function* () {
          const client = yield* Effect.acquireRelease(
            Effect.tryPromise({
              try: () => pool.connect(),
              catch: (cause) => toSqlError(cause, "Could not acquire a migration connection"),
            }),
            (connection) =>
              Effect.sync(() => {
                connection.release();
              }),
          );

          yield* applyFile(client, content, migration);
        }),
      );

      applied.push([migration.id, migration.name]);

      yield* Effect.logInfo(`SQL migration applied: ${migration.id}_${migration.name}`);
    }

    return applied;
  });

export const runSqlMigrations = Effect.gen(function* () {
  const path = yield* Path;
  const moduleDir = new URL(".", import.meta.url).pathname;
  return yield* runSqlMigrationsFrom(path.resolve(moduleDir, "sql"));
});
