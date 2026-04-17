/** Health Routes */

import { Effect } from "effect";
import { healthCheck as postgresHealthCheck } from "@infrastructure/db/postgres/client";

export const healthRoute = () =>
  Effect.tryPromise({
    try: async () => {
      const postgres = await postgresHealthCheck();
      return {
        status: "ok",
        timestamp: new Date(),
        uptime: process.uptime(),
        postgres,
      };
    },
    catch: (error) => ({ status: 500, message: `Health check failed: ${error}` }),
  });
