import { Context, type Effect } from "effect";
import type { HealthError } from "../../shared/errors";

export { HealthError } from "../../shared/errors";

type HealthStatus = {
  readonly status: "ok";
  readonly timestamp: Date;
  readonly uptime: number;
  readonly postgres: boolean;
};

export interface HealthServicePort {
  readonly check: () => Effect.Effect<HealthStatus, HealthError>;
}

export class HealthService extends Context.Service<HealthService, HealthServicePort>()(
  "HealthService",
) {}
