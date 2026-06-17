import { Effect, Layer, Schedule } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql/SqlClient";
import * as PgClientModule from "@effect/sql-pg/PgClient";
import { PostgresConnectionPool } from "./db/postgres";
import { runSqlMigrations } from "./migrations/sql-migration.runner";

export const MigrationLayer: Layer.Layer<never, never, PostgresConnectionPool | FileSystem | Path> =
  Layer.effectDiscard(
    Effect.gen(function* () {
      const pool = yield* PostgresConnectionPool;
      if (pool === null) {
        yield* Effect.logInfo("No DATABASE_URL configured — skipping auth migrations");
        return;
      }

      const pgClient = yield* PgClientModule.fromPool({
        acquire: Effect.succeed(pool),
        spanAttributes: { "db.operation": "auth-migration" },
      });

      const result = yield* runSqlMigrations.pipe(Effect.provideService(SqlClient, pgClient));

      yield* Effect.logInfo(
        `Auth SQL migrations applied: ${result.map(([id, name]) => `${id}_${name}`).join(", ")}`,
      );

      const runCleanup = (pool: import("pg").Pool) =>
        Effect.tryPromise(async () => {
          await pool.query("BEGIN");
          try {
            await pool.query("DELETE FROM oauth_states WHERE expires_at < NOW()");
            await pool.query("DELETE FROM auth_codes WHERE expires_at < NOW()");
            await pool.query("DELETE FROM refresh_token_blocklist WHERE expires_at < NOW()");
            await pool.query("COMMIT");
          } catch (e) {
            await pool.query("ROLLBACK");
            throw e;
          }
        }).pipe(Effect.orDie);

      yield* runCleanup(pool);

      yield* Effect.forkDetach(
        Effect.repeat(runCleanup(pool), Schedule.fixed("1 hour")).pipe(Effect.ignore),
      );
    }).pipe(Effect.provide(Reactivity.layer), Effect.scoped, Effect.orDie),
  );
