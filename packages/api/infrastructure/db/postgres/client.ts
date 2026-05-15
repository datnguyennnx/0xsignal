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

// --- Migration backward compat: minimal pool for startup migrations ---
let migrationPool: pg.Pool | null = null;

function getMigrationPool(): pg.Pool {
  if (!migrationPool) {
    const connStr =
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL ||
      `postgres://${process.env.POSTGRES_USER || "postgres"}:${process.env.POSTGRES_PASSWORD || "postgres"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "0xsignal"}`;
    migrationPool = new pg.Pool({ connectionString: connStr });
    migrationPool.on("error", (err) => console.error("Migration pool error:", err));
  }
  return migrationPool;
}

/** Get a PoolClient for migration code (runs before Layers are available). */
export async function getMigrationClient(): Promise<PoolClient> {
  return getMigrationPool().connect();
}

/** Run a simple query for migration status checks. */
export async function migrationQuery(sql: string, params?: unknown[]) {
  return getMigrationPool().query(sql, params);
}
