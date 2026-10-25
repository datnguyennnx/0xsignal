import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../db/postgres";
import type { AgentRegistration } from "../../domain/agent-registration";
import { pgAgentRegistrationRepo } from "./agent-registration.repo.pg";

// Port interface

export interface AgentRegistrationRepoPort {
  readonly listByUserId: (userId: string) => Effect.Effect<readonly AgentRegistration[]>;
}

// Context Service

export class AgentRegistrationRepo extends Context.Service<
  AgentRegistrationRepo,
  AgentRegistrationRepoPort
>()("AgentRegistrationRepo") {}

// Layer

export const AgentRegistrationRepoLayer: Layer.Layer<
  AgentRegistrationRepo,
  never,
  PostgresConnectionPool
> = Layer.effect(
  AgentRegistrationRepo,
  Effect.gen(function* () {
    const pg = yield* PostgresConnectionPool;

    if (pg === null) {
      return yield* Effect.die(
        new Error("PostgresConnectionPool required but was null — provide a proper pool"),
      );
    }

    return pgAgentRegistrationRepo(pg);
  }),
);
