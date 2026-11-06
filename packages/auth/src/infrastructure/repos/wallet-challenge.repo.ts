import { Context, Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../db/postgres";
import { pgWalletChallengeRepo } from "./wallet-challenge.repo.pg";
import type { WalletChallengeRepoPort } from "./repo-ports.types";

export type { WalletChallengeRepoPort } from "./repo-ports.types";

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
