import { Effect, Layer } from "effect";
import { HealthServices } from "@application/health";
import { healthCheck as postgresHealthCheck } from "@infrastructure/db/postgres/client";

export const HealthServicesLive = Layer.succeed(HealthServices, {
  check: () =>
    Effect.tryPromise({
      try: async () => {
        const postgres = await postgresHealthCheck();
        return {
          status: "ok" as const,
          timestamp: new Date(),
          uptime: process.uptime(),
          postgres,
        };
      },
      catch: (error) => ({ status: 500, message: `Health check failed: ${error}` }),
    }),
});
