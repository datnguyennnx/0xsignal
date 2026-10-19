import { Context, Data, Effect, Layer } from "effect";
import type { WhalePosition, WhalePositionsQuery } from "@0xsignal/shared";
import { PostgresConnectionPool } from "@0xsignal/auth";
import { pgWhaleRepo } from "./whale.repo.pg";

export class WhaleRepoError extends Data.TaggedError("WhaleRepoError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface WhaleWalletInput {
  readonly address: string;
  readonly lastTradeAt?: string;
  readonly lastNotionalUsd?: number;
}

export interface WhalePositionKey {
  readonly userAddress: string;
  readonly coin: string;
}

export interface WhalePositionsPage {
  readonly positions: readonly WhalePosition[];
  readonly nextCursor?: string | null;
}

export interface WhaleRepoPort {
  readonly upsertWallets: (
    wallets: readonly WhaleWalletInput[],
  ) => Effect.Effect<number, WhaleRepoError>;

  readonly upsertPositions: (
    positions: readonly WhalePosition[],
  ) => Effect.Effect<number, WhaleRepoError>;

  readonly deleteClosedPositions: (
    keys: readonly WhalePositionKey[],
  ) => Effect.Effect<number, WhaleRepoError>;

  readonly queryPositions: (
    q: WhalePositionsQuery,
  ) => Effect.Effect<WhalePositionsPage, WhaleRepoError>;

  readonly pruneWallets: (before: Date) => Effect.Effect<number, WhaleRepoError>;

  readonly deletePositionsForAddresses: (
    addresses: readonly string[],
  ) => Effect.Effect<number, WhaleRepoError>;

  readonly pruneStalePositions: (before: Date) => Effect.Effect<number, WhaleRepoError>;
}

export class WhaleRepo extends Context.Service<WhaleRepo, WhaleRepoPort>()("WhaleRepo") {}

export const WhaleRepoLayer: Layer.Layer<WhaleRepo, never, PostgresConnectionPool> = Layer.effect(
  WhaleRepo,
  Effect.gen(function* () {
    const pg = yield* PostgresConnectionPool;

    if (pg === null) {
      return yield* Effect.die(
        new Error("PostgresConnectionPool required but was null — provide a proper pool"),
      );
    }

    return pgWhaleRepo(pg);
  }),
);
