import { Clock, Effect, Layer } from "effect";
import { HealthServices } from "../../application/health";
import { PostgresConnectionPool } from "../db/postgres/client";

export const HealthServicesLive = Layer.effect(
  HealthServices,
  Effect.gen(function* () {
    const pool = yield* PostgresConnectionPool;

    return {
      check: () =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          return yield* Effect.tryPromise({
            try: async () => {
              const result = await pool.query("SELECT 1 as health");
              const postgres = result.rows[0]?.health === 1;
              return {
                status: "ok" as const,
                timestamp: new Date(now),
                uptime: process.uptime(),
                postgres,
              };
            },
            catch: (error) => ({ status: 500, message: `Health check failed: ${error}` }),
          });
        }),
    };
  })
);
