import { Context, Data, Effect } from "effect";

export type HealthStatus = {
  readonly status: "ok";
  readonly timestamp: Date;
  readonly uptime: number;
  readonly postgres: boolean;
};

export class HealthError extends Data.TaggedError("HealthError")<{
  readonly status: number;
  readonly message: string;
}> {}

export interface HealthServicePort {
  readonly check: () => Effect.Effect<HealthStatus, HealthError>;
}

export class HealthService extends Context.Service<HealthService, HealthServicePort>()(
  "HealthService",
) {}
