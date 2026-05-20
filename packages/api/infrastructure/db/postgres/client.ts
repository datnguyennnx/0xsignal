import { Config, Context, Effect, Layer } from "effect";
import pg, { type PoolClient } from "pg";

export type { PoolClient };

// Context Tag for the Postgres connection pool
export class PostgresConnectionPool extends Context.Tag("PostgresConnectionPool")<
  PostgresConnectionPool,
  pg.Pool
>() {}

// Layer that creates the pool via acquireRelease
export const PostgresConnectionPoolLive = Layer.scoped(
  PostgresConnectionPool,
  Effect.acquireRelease(
    Effect.gen(function* () {
      const connectionString = yield* Config.string("DATABASE_URL").pipe(
        Config.orElse(() => Config.string("POSTGRES_URL"))
      );

      const pool = new pg.Pool({
        connectionString,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      pool.on("error", (err: Error) => {
        console.error("Unexpected PostgreSQL pool error:", err);
      });

      return pool;
    }),
    (pool) =>
      Effect.sync(() => {
        console.log("Closing PostgreSQL pool...");
        pool.end().catch((err) => console.error("Error closing pool:", err));
      })
  )
);
