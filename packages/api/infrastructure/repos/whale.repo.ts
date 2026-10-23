import { Effect, Layer } from "effect";
import { PostgresConnectionPool } from "@0xsignal/auth";
import { WhaleRepo } from "../../application/whales/repo.contracts";
import { pgWhaleRepo } from "./whale.repo.pg";

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
