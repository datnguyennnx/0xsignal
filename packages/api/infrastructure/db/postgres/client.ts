import { Config, Data, Effect, Layer, Option } from "effect";
import pg, { type PoolClient } from "pg";

import { PostgresConnectionPool } from "@0xsignal/shared/db/postgres";

export type { PoolClient };

export class PostgresConnectionError extends Data.TaggedError("PostgresConnectionError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// Layer that creates the pool via acquireRelease (optional — null if unconfigured)
export const postgresConnectionPoolLayer = Layer.effect(
  PostgresConnectionPool,
  Effect.acquireRelease(
    Effect.gen(function* () {
      const maybeUrl = yield* Config.option(
        Config.string("DATABASE_URL").pipe(Config.orElse(() => Config.string("POSTGRES_URL")))
      );

      if (Option.isNone(maybeUrl)) {
        yield* Effect.logWarning("No DATABASE_URL or POSTGRES_URL set — Postgres pool disabled");
        return null;
      }

      const pool = new pg.Pool({
        connectionString: maybeUrl.value,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // ── Bridge Pattern: Effect.runSync in 3rd-party event callback ──
      // pg.Pool emits "error" events from a non-Effect context (Node event
      // emitter). We cannot yield* inside this callback. Effect.runSync is
      // the correct way to log an Effect within a synchronous event handler.
      // This is an acceptable bridge pattern — documented as such.
      pool.on("error", (err: Error) => {
        Effect.runSync(Effect.logError(`Unexpected PostgreSQL pool error: ${err.message}`));
      });

      return pool;
    }),
    (pool) =>
      Effect.gen(function* () {
        if (pool === null) return;
        yield* Effect.logInfo("Closing PostgreSQL pool...");
        yield* Effect.tryPromise({
          try: () => pool.end(),
          catch: (error) => new PostgresConnectionError({ message: String(error), cause: error }),
        }).pipe(Effect.catch((err) => Effect.logError(`Error closing pool: ${err.message}`)));
      })
  )
);
