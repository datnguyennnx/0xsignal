import { readdir, readFile } from "node:fs/promises";
import { Effect, FileSystem, Path, Redacted, Result } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql/SqlClient";
import * as PgClientModule from "@effect/sql-pg/PgClient";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PostgresConnectionPool } from "../../db/postgres";
import { runSqlMigrationsFrom } from "../sql-migration.runner";

const fixturesDir = new URL("./fixtures/", import.meta.url).pathname;

// A real database is required, so the suite only runs when pointed at a scratch
// database; the name check keeps it from ever touching a live one.
const databaseUrl = process.env.MIGRATION_TEST_DATABASE_URL ?? "";
const databaseName = databaseUrl === "" ? "" : new URL(databaseUrl).pathname.slice(1);

const FileSystemLayer = FileSystem.layerNoop({
  readDirectory: (path) => Effect.promise(() => readdir(path)),
  readFileString: (path) => Effect.promise(() => readFile(path, "utf8")),
});

const runMigrations = (pool: Pool) =>
  Effect.gen(function* () {
    const pgClient = yield* PgClientModule.make({ url: Redacted.make(databaseUrl) });
    return yield* runSqlMigrationsFrom(fixturesDir).pipe(
      Effect.provideService(SqlClient, pgClient),
      Effect.provideService(PostgresConnectionPool, pool),
      Effect.provide(FileSystemLayer),
      Effect.provide(Path.layer),
    );
  }).pipe(Effect.scoped, Effect.provide(Reactivity.layer));

const failureMessage = (result: Result.Result<unknown, unknown>): string =>
  Result.isFailure(result) ? String(result.failure) : "";

const resetScratchDatabase = async (pool: Pool): Promise<void> => {
  await pool.query("DROP TABLE IF EXISTS rollback_probe, multi_probe CASCADE");
  await pool.query("DROP TABLE IF EXISTS auth_migrations");
};

describe.skipIf(!databaseName.endsWith("_probe"))("sql migration runner", () => {
  it("applies several statements per file, rolls back a failing file, and skips applied files", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await resetScratchDatabase(pool);

      const first = await Effect.runPromise(Effect.result(runMigrations(pool)));
      expect(failureMessage(first)).toContain("002_rollback");

      const table = await pool.query<{ name: string | null }>(
        "SELECT to_regclass('public.multi_probe') AS name",
      );
      expect(table.rows[0]?.name).toBe("multi_probe");

      const index = await pool.query<{ indexname: string }>(
        "SELECT indexname FROM pg_indexes WHERE tablename = 'multi_probe'",
      );
      expect(index.rows.map((row) => row.indexname)).toContain("idx_multi_probe_label");

      const trigger = await pool.query<{ tgname: string }>(
        "SELECT tgname FROM pg_trigger WHERE tgrelid = 'multi_probe'::regclass AND NOT tgisinternal",
      );
      expect(trigger.rows.map((row) => row.tgname)).toContain("multi_probe_touch");

      const rows = await pool.query<{ id: number }>("SELECT id FROM multi_probe ORDER BY id");
      expect(rows.rows.map((row) => row.id)).toEqual([1, 2]);

      const rolledBack = await pool.query<{ name: string | null }>(
        "SELECT to_regclass('public.rollback_probe') AS name",
      );
      expect(rolledBack.rows[0]?.name).toBeNull();

      const ledger = await pool.query<{ migration_id: number; name: string }>(
        "SELECT migration_id, name FROM auth_migrations ORDER BY migration_id",
      );
      expect(ledger.rows).toEqual([{ migration_id: 1, name: "multi_statement" }]);

      const second = await Effect.runPromise(Effect.result(runMigrations(pool)));
      expect(failureMessage(second)).toContain("002_rollback");

      const count = await pool.query<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM multi_probe",
      );
      expect(count.rows[0]?.count).toBe(2);
    } finally {
      await resetScratchDatabase(pool);
      await pool.end();
    }
  });
});
