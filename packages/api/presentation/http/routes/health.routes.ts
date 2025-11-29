/** Health Routes */

import { Effect } from "effect";

export const healthRoute = () =>
  Effect.succeed({
    status: "ok",
    timestamp: new Date(),
    uptime: process.uptime(),
  });
