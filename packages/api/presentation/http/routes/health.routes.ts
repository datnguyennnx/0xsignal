/** Health Routes */

import { Effect } from "effect";
import { HealthServices } from "@application/health";

export const healthRoute = () =>
  Effect.gen(function* () {
    const health = yield* HealthServices;
    return yield* health.check();
  });
