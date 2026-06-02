import { Config, Effect, Layer, Option } from "effect";
import pg, { type PoolClient } from "pg";

import { PostgresConnectionPool } from "@0xsignal/shared/db/postgres";

export type { PoolClient };

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

      pool.on("error", (err: Error) => {
        console.error("Unexpected PostgreSQL pool error:", err);
      });

      return pool;
    }),
    (pool) =>
      Effect.sync(() => {
        if (pool !== null) {
          console.log("Closing PostgreSQL pool...");
          pool.end().catch((err) => console.error("Error closing pool:", err));
        }
      })
  )
);
