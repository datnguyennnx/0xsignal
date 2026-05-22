import { Context, Effect } from "effect";

export type HealthStatus = {
  readonly status: "ok";
  readonly timestamp: Date;
  readonly uptime: number;
  readonly postgres: boolean;
};

export type HealthError = {
  readonly status: number;
  readonly message: string;
};

export interface HealthServicePort {
  readonly check: () => Effect.Effect<HealthStatus, HealthError>;
}

export class HealthService extends Context.Tag("HealthService")<
  HealthService,
  HealthServicePort
>() {}
