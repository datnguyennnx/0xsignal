import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../db/postgres";
import type { WalletChallenge } from "../../domain/wallet-challenge";
import {
  WalletChallengeAddressMismatch,
  WalletChallengeExpired,
  WalletChallengeNotFound,
  WalletChallengeUsed,
} from "../../domain/errors";
import { pgWalletChallengeRepo } from "./wallet-challenge.repo.pg";

export interface IssueWalletChallengeParams {
  readonly userId: string;
  readonly walletAddress: string;
  readonly nonce: string;
  readonly message: string;
  readonly expiresAt: Date;
}

export interface WalletChallengeLookupParams {
  readonly userId: string;
  readonly walletAddress: string;
  readonly nonce: string;
}

export type WalletChallengeLookupError =
  | WalletChallengeNotFound
  | WalletChallengeExpired
  | WalletChallengeUsed
  | WalletChallengeAddressMismatch;

export interface WalletChallengeRepoPort {
  /** Replaces any outstanding challenge for the same user + address. */
  readonly issue: (params: IssueWalletChallengeParams) => Effect.Effect<WalletChallenge>;

  readonly findActive: (
    params: WalletChallengeLookupParams,
  ) => Effect.Effect<WalletChallenge, WalletChallengeLookupError>;

  /** Atomically marks the challenge consumed; a second call fails as used. */
  readonly consume: (
    params: WalletChallengeLookupParams,
  ) => Effect.Effect<void, WalletChallengeLookupError>;
}

export class WalletChallengeRepo extends Context.Service<
  WalletChallengeRepo,
  WalletChallengeRepoPort
>()("WalletChallengeRepo") {}

export const WalletChallengeRepoLayer: Layer.Layer<
  WalletChallengeRepo,
  never,
  PostgresConnectionPool
> = Layer.effect(
  WalletChallengeRepo,
  Effect.gen(function* () {
    const pg = yield* PostgresConnectionPool;

    if (pg === null) {
      return yield* Effect.die(
        new Error("PostgresConnectionPool required but was null — provide a proper pool"),
      );
    }

    return pgWalletChallengeRepo(pg);
  }),
);
