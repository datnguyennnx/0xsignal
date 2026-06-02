import { Effect, Layer, Schedule } from "effect";
import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql/SqlClient";
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import * as PgClientModule from "@effect/sql-pg/PgClient";
import * as PgMigrator from "@effect/sql-pg/PgMigrator";
import { PostgresConnectionPool } from "@0xsignal/shared/db/postgres";
import { migrations } from "./migrations";

const { PgClient } = PgClientModule;

export const MigrationLayer: Layer.Layer<
  never,
  never,
  PostgresConnectionPool | ChildProcessSpawner | FileSystem | Path
> = Layer.effectDiscard(
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

    const result = yield* PgMigrator.run({
      loader: migrations,
      table: "auth_migrations",
    }).pipe(Effect.provideService(PgClient, pgClient), Effect.provideService(SqlClient, pgClient));

    yield* Effect.logInfo(
      `Auth migrations applied: ${result.map(([id, name]) => `${id}_${name}`).join(", ")}`
    );

    const runCleanup = (sql: any) =>
      Effect.gen(function* () {
        yield* Effect.logInfo(
          "[Cleanup] Running expired states, auth codes, and blocklist cleanup..."
        );
        yield* Effect.tryPromise(() =>
          sql.query("DELETE FROM oauth_states WHERE expires_at < NOW()")
        ).pipe(Effect.orDie);
        yield* Effect.tryPromise(() =>
          sql.query("DELETE FROM auth_codes WHERE expires_at < NOW()")
        ).pipe(Effect.orDie);
        yield* Effect.tryPromise(() =>
          sql.query("DELETE FROM refresh_token_blocklist WHERE expires_at < NOW()")
        ).pipe(Effect.orDie);
      });

    // Run once at startup
    yield* runCleanup(pool);

    // Repeat every 1 hour in background daemon
    yield* Effect.forkDetach(
      Effect.repeat(runCleanup(pool), Schedule.fixed("1 hour")).pipe(
        Effect.catch(() => Effect.void)
      )
    );
  }).pipe(Effect.provide(Reactivity.layer), Effect.scoped, Effect.orDie)
);
