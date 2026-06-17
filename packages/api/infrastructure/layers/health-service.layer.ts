import { Clock, Effect, Layer } from "effect";
import { HealthError, HealthService } from "../../application/health";
import { PostgresConnectionPool } from "@0xsignal/auth";

export const healthServiceLayer = Layer.effect(
  HealthService,
  Effect.gen(function* () {
    const pool = yield* PostgresConnectionPool;
    const startTime = yield* Clock.currentTimeMillis;

    return HealthService.of({
      check: () =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          const uptime = now - startTime;

          if (pool === null) {
            return {
              status: "ok" as const,
              timestamp: new Date(now),
              uptime,
              postgres: false,
            };
          }

          const result = yield* Effect.tryPromise({
            try: async () => {
              const res = await pool.query("SELECT 1 as health");
              return res.rows[0]?.health === 1;
            },
            catch: (error) =>
              new HealthError({ status: 500, message: `Health check failed: ${error}` }),
          });

          return {
            status: "ok" as const,
            timestamp: new Date(now),
            uptime,
            postgres: result,
          };
        }),
    });
  }),
);
