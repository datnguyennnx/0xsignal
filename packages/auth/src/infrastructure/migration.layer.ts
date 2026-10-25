import { Config, Effect, Layer, Option, Schedule } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql/SqlClient";
import * as PgClientModule from "@effect/sql-pg/PgClient";
import { PostgresConnectionPool } from "./db/postgres";
import { runSqlMigrations } from "./migrations/sql-migration.runner";

const runCleanup = (pg: import("pg").Pool) =>
  Effect.tryPromise(async () => {
    await pg.query("BEGIN");
    try {
      await pg.query("DELETE FROM oauth_states WHERE expires_at < NOW()");
      await pg.query("DELETE FROM auth_codes WHERE expires_at < NOW()");
      await pg.query("DELETE FROM refresh_token_blocklist WHERE expires_at < NOW()");
      await pg.query("COMMIT");
    } catch (e) {
      await pg.query("ROLLBACK");
      throw e;
    }
  }).pipe(Effect.orDie);

export const MigrationLayer: Layer.Layer<never, never, PostgresConnectionPool | FileSystem | Path> =
  Layer.effectDiscard(
    Effect.gen(function* () {
      const pool = yield* PostgresConnectionPool;
      if (pool === null) {
        yield* Effect.logInfo("No DATABASE_URL configured — skipping auth migrations");
        return;
      }

      const maybeUrl = yield* Config.option(
        Config.Redacted("DATABASE_URL").pipe(Config.orElse(() => Config.Redacted("POSTGRES_URL"))),
      );
      if (Option.isNone(maybeUrl)) {
        yield* Effect.logInfo("No DATABASE_URL configured — skipping auth migrations");
        return;
      }

      const pgClient = yield* PgClientModule.make({
        url: maybeUrl.value,
        spanAttributes: { "db.operation": "auth-migration" },
      });

      const result = yield* runSqlMigrations.pipe(Effect.provideService(SqlClient, pgClient));

      yield* Effect.logInfo(
        `Auth SQL migrations applied: ${result.map(([id, name]) => `${id}_${name}`).join(", ")}`,
      );

      yield* runCleanup(pool);

      yield* Effect.forkScoped(
        Effect.repeat(runCleanup(pool), Schedule.fixed("1 hour")).pipe(Effect.ignore),
      );
    }).pipe(Effect.provide(Reactivity.layer), Effect.scoped, Effect.orDie),
  );
