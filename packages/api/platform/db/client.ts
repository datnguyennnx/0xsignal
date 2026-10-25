import { Config, Data, Effect, Layer, Option, Queue, type Scope, Stream } from "effect";
import { Pool } from "pg";

import { PostgresConnectionPool } from "@0xsignal/auth";

class PostgresConnectionError extends Data.TaggedError("PostgresConnectionError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** The pg surface the error bridge needs, so it can be exercised without a live pool. */
export interface PoolErrorSource {
  readonly on: (event: "error", listener: (err: Error) => void) => unknown;
}

/** Bounded so a pool that fails in a tight loop cannot grow memory without limit. */
const POOL_ERROR_QUEUE_CAPACITY = 256;

// pg emits "error" from a Node event emitter, outside any Effect. The handler
// only enqueues; a fiber in the layer scope logs, so the log runs in the layer's
// context instead of a freshly started runtime.
export const bridgePoolErrors = (pool: PoolErrorSource): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    const errors = yield* Queue.sliding<Error>(POOL_ERROR_QUEUE_CAPACITY);
    yield* Stream.fromQueue(errors).pipe(
      Stream.runForEach((err) =>
        Effect.logError(`Unexpected PostgreSQL pool error: ${err.message}`),
      ),
      Effect.forkScoped,
    );

    pool.on("error", (err) => {
      Queue.offerUnsafe(errors, err);
    });
  });

// Layer that creates the pool via acquireRelease (optional — null if unconfigured)
// Direct pg.Pool (no @effect/sql-pg).
export const postgresConnectionPoolLayer = Layer.effect(
  PostgresConnectionPool,
  Effect.acquireRelease(
    Effect.gen(function* () {
      const maybeUrl = yield* Config.option(
        Config.String("DATABASE_URL").pipe(Config.orElse(() => Config.String("POSTGRES_URL"))),
      );

      if (Option.isNone(maybeUrl)) {
        yield* Effect.logWarning("No DATABASE_URL or POSTGRES_URL set — Postgres pool disabled");
        return null;
      }

      const pool = new Pool({
        connectionString: maybeUrl.value,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      yield* bridgePoolErrors(pool);

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
      }),
  ),
);
