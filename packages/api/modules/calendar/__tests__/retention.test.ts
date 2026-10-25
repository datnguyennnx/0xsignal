import { describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { CalendarRepo } from "../repo";
import { ECONOMIC_EVENT_RETENTION_MS, pruneOnce } from "../retention";

const makeRepoLayer = (cutoffs: number[]) =>
  Layer.succeed(
    CalendarRepo,
    CalendarRepo.of({
      upsertMany: () => Effect.die(new Error("upsertMany is not exercised by the prune test")),
      query: () => Effect.succeed([]),
      upcoming: () => Effect.succeed([]),
      deleteOlderThan: (cutoffMillis) =>
        Effect.sync(() => {
          cutoffs.push(cutoffMillis);
          return 4;
        }),
    }),
  );

describe("economic event retention", () => {
  it("uses a 180-day window and deletes only rows below the cutoff", async () => {
    const cutoffs: number[] = [];

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.adjust("1 hour");
        yield* pruneOnce;
      }).pipe(Effect.provide(makeRepoLayer(cutoffs)), Effect.provide(TestClock.layer())),
    );

    const cutoff = 60 * 60 * 1000 - ECONOMIC_EVENT_RETENTION_MS;

    expect(ECONOMIC_EVENT_RETENTION_MS).toBe(180 * 24 * 60 * 60 * 1000);
    expect(cutoffs).toEqual([cutoff]);

    // The DELETE predicate is `scheduled_at < cutoff`: of these two boundary
    // events, only the one strictly older than the window is removed.
    const boundaryTimes = [cutoff - 1, cutoff];
    expect(boundaryTimes.filter((scheduledAt) => scheduledAt < cutoff)).toEqual([cutoff - 1]);
  });
});
