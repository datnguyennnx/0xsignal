import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../db/postgres";
import type { ExchangeAccount } from "../../domain/exchange-credential";
import { AccountNotFound, DuplicateLabel } from "../../domain/errors";
import { pgExchangeAccountRepo } from "./exchange-account.repo.pg";

// Input types

export interface CreateExchangeAccountParams {
  readonly userId: string;
  readonly exchangeSlug: string;
  readonly nodeType: "wallet" | "sub" | "vault";
  readonly parentId?: string;
  readonly walletAddress: string;
  readonly chain?: string;
  readonly label?: string;
  readonly color?: string;
  readonly sortOrder?: number;
  readonly metadata?: Record<string, unknown>;
}

// Port interface

export interface ExchangeAccountRepoPort {
  readonly create: (
    params: CreateExchangeAccountParams,
  ) => Effect.Effect<ExchangeAccount, AccountNotFound | DuplicateLabel>;

  readonly findById: (
    id: string,
    userId: string,
  ) => Effect.Effect<ExchangeAccount, AccountNotFound>;

  readonly findByUserId: (
    userId: string,
    exchangeSlug?: string,
  ) => Effect.Effect<readonly ExchangeAccount[], never>;

  readonly findPrimary: (
    userId: string,
    exchangeSlug: string,
  ) => Effect.Effect<ExchangeAccount, AccountNotFound>;

  readonly findWithDescendants: (
    accountId: string,
  ) => Effect.Effect<readonly ExchangeAccount[], never>;

  readonly resolveMasterWallet: (accountId: string) => Effect.Effect<string, AccountNotFound>;

  readonly setPrimary: (accountId: string, userId: string) => Effect.Effect<void, AccountNotFound>;

  readonly deactivate: (accountId: string, userId: string) => Effect.Effect<void, AccountNotFound>;
}

// Context Service

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
