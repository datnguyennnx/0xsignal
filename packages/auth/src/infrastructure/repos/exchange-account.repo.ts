import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../db/postgres";
import { pgExchangeAccountRepo } from "./exchange-account.repo.pg";
import type { ExchangeAccountRepoPort } from "./repo-ports.types";

export type { ExchangeAccountRepoPort } from "./repo-ports.types";

export class ExchangeAccountRepo extends Context.Service<
  ExchangeAccountRepo,
  ExchangeAccountRepoPort
>()("ExchangeAccountRepo") {}

// Layer

export const ExchangeAccountRepoLayer: Layer.Layer<
  ExchangeAccountRepo,
  never,
  PostgresConnectionPool
> = Layer.effect(
  ExchangeAccountRepo,
  Effect.gen(function* () {
    const pg = yield* PostgresConnectionPool;

    if (pg === null) {
      return yield* Effect.die(
        new Error("PostgresConnectionPool required but was null — provide a proper pool"),
      );
    }

    return pgExchangeAccountRepo(pg);
  }),
);

// Note: DB row mapping (mapRow) lives in exchange-account.repo.pg.ts — not exported from this facade.
