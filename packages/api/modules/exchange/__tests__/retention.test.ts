import { describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { OrderIntentRepo } from "../intent-repo";
import { ORDER_INTENT_RETENTION_MS } from "../intent";
import { pruneOnce } from "../retention";

const makeRepoLayer = (cutoffs: number[]) =>
  Layer.succeed(
    OrderIntentRepo,
    OrderIntentRepo.of({
      insert: () => Effect.die(new Error("insert is not exercised by the prune test")),
      findById: () => Effect.succeed(null),
      markExpired: () => Effect.succeed(null),
      closePending: () => Effect.succeed(null),
      deleteOlderThan: (cutoffMillis) =>
        Effect.sync(() => {
          cutoffs.push(cutoffMillis);
          return 4;
        }),
    }),
  );

describe("order intent retention", () => {
  it("uses a 30-day window and deletes below the cutoff", async () => {
    const cutoffs: number[] = [];

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.adjust("1 hour");
        yield* pruneOnce;
      }).pipe(Effect.provide(makeRepoLayer(cutoffs)), Effect.provide(TestClock.layer())),
    );

    expect(ORDER_INTENT_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(cutoffs).toEqual([60 * 60 * 1000 - ORDER_INTENT_RETENTION_MS]);
  });
});
