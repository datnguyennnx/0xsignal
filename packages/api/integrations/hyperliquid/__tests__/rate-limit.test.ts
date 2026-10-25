import { describe, expect, it } from "vitest";
import { Clock, Effect, Fiber, Predicate } from "effect";
import { TestClock } from "effect/testing";
import {
  acquireCandleSnapshot,
  makeLimiter,
  HyperliquidRateLimiter,
  RateLimitBudgetExhaustedError,
} from "../rate-limit";
import { candleSnapshotWeight, INFO_WEIGHTS } from "../weights";

describe("HyperliquidRateLimiter", () => {
  it("admits a 236-weight page-load burst immediately under the shipped defaults", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 1200 });
      const start = yield* Clock.currentTimeMillis;
      const fiber = yield* limiter.acquire(236).pipe(Effect.forkChild);
      yield* Fiber.join(fiber);
      return (yield* Clock.currentTimeMillis) - start;
    });

    const elapsedMillis = await Effect.runPromise(Effect.provide(program, TestClock.layer()));

    expect(elapsedMillis).toBe(0);
    expect(elapsedMillis).toBeLessThan(1000);
  });

  it("admits a documented 20-weight meta call without a cold-start wait", async () => {
    expect(INFO_WEIGHTS.meta).toBe(20);

    const program = Effect.gen(function* () {
      const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 1200 });
      const start = yield* Clock.currentTimeMillis;
      const fiber = yield* limiter.acquire(INFO_WEIGHTS.meta).pipe(Effect.forkChild);
      yield* Fiber.join(fiber);
      return (yield* Clock.currentTimeMillis) - start;
    });

    const elapsedMillis = await Effect.runPromise(Effect.provide(program, TestClock.layer()));
    expect(elapsedMillis).toBe(0);
  });

  it("does not queue a light acquire behind a sleeping heavy one (20-weight burst bucket)", async () => {
    const program = Effect.gen(function* () {
      // Budget fills at 20/s; draining it makes the next 20-weight call sleep.
      const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 1200, burstCapacity: 20 });
      yield* limiter.acquire(20);
      const start = yield* Clock.currentTimeMillis;

      const heavy = yield* limiter.acquire(20).pipe(Effect.forkChild);
      const light = yield* limiter.acquire(2).pipe(Effect.forkChild);

      yield* TestClock.adjust("100 millis");
      yield* Fiber.join(light);
      const lightElapsed = (yield* Clock.currentTimeMillis) - start;

      yield* TestClock.adjust("1000 millis");
      yield* Fiber.join(heavy);
      const heavyElapsed = (yield* Clock.currentTimeMillis) - start;

      return { lightElapsed, heavyElapsed };
    });

    const timing = await Effect.runPromise(Effect.provide(program, TestClock.layer()));

    // Under a lock held across sleep the light wait could not finish before the
    // heavy one; it now pays only its own 2/20 = 100ms.
    expect(timing.lightElapsed).toBe(100);
    expect(timing.heavyElapsed).toBe(1100);
    expect(timing.lightElapsed).toBeLessThan(timing.heavyElapsed);
  });

  it("fails fast with the tagged error when weight exceeds the configured 100-weight burst capacity", async () => {
    const startedAt = Date.now();
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 1200, burstCapacity: 100 });
        return yield* limiter.acquire(150).pipe(Effect.flip);
      }),
    );

    expect(error instanceof RateLimitBudgetExhaustedError).toBe(true);
    expect(Predicate.isTagged(error, "RateLimitBudgetExhaustedError")).toBe(true);
    expect(error.weight).toBe(150);
    expect(error.capacityPerMin).toBe(1200);
    expect(error.message).toContain("burst capacity 100");
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  it("fails fast when weight exceeds a configured 100 per-minute ceiling but fits the burst bucket", async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 100 });
        return yield* limiter.acquire(150).pipe(Effect.flip);
      }),
    );

    expect(Predicate.isTagged(error, "RateLimitBudgetExhaustedError")).toBe(true);
    expect(error.weight).toBe(150);
    expect(error.capacityPerMin).toBe(100);
    expect(error.message).toContain("per-minute ceiling 100");
    expect(error.message).not.toContain("burst capacity");
  });

  it("charges candleSnapshot 25 weight for a 350-item request (25-weight burst bucket)", async () => {
    expect(INFO_WEIGHTS.candleSnapshot).toBe(20);
    expect(candleSnapshotWeight(350)).toBe(25);
    expect(candleSnapshotWeight(59)).toBe(20);
    expect(candleSnapshotWeight(60)).toBe(21);

    const program = Effect.gen(function* () {
      const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 1200, burstCapacity: 25 });
      const service = HyperliquidRateLimiter.of(limiter);
      yield* acquireCandleSnapshot(350).pipe(
        Effect.provideService(HyperliquidRateLimiter, service),
      );

      const start = yield* Clock.currentTimeMillis;
      const fiber = yield* limiter.acquire(25).pipe(Effect.forkChild);
      yield* TestClock.adjust("1250 millis");
      yield* Fiber.join(fiber);
      return (yield* Clock.currentTimeMillis) - start;
    });

    // 25 weight was consumed by the candle call, so the next 25 weight refills
    // at 20/s over 1.25s.
    const refillMillis = await Effect.runPromise(Effect.provide(program, TestClock.layer()));
    expect(refillMillis).toBe(1250);
  });

  it("caps the first minute at 1200 weight under the shipped defaults and admits the last tranche at 60s", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 1200 });
      const start = yield* Clock.currentTimeMillis;
      // 13 tranches of 100 = 1300 weight, one past the documented minute budget.
      const fiber = yield* Effect.forEach(
        Array.from({ length: 13 }, (_, index) => index),
        () => limiter.acquire(100),
        { discard: true },
      ).pipe(Effect.forkChild);

      yield* TestClock.adjust("59 seconds");
      const admittedBeforeMinute = yield* Effect.sync(() => fiber.pollUnsafe() !== undefined);
      yield* TestClock.adjust("1 second");
      yield* Fiber.join(fiber);

      return {
        admittedBeforeMinute,
        elapsedMillis: (yield* Clock.currentTimeMillis) - start,
      };
    });

    const result = await Effect.runPromise(Effect.provide(program, TestClock.layer()));

    expect(result.admittedBeforeMinute).toBe(false);
    expect(result.elapsedMillis).toBe(60_000);
  });

  it("admits a 400-weight burst instantly but makes the next 400 wait for the smoothing refill", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 1200 });
      const start = yield* Clock.currentTimeMillis;
      yield* limiter.acquire(400);
      const firstElapsedMillis = (yield* Clock.currentTimeMillis) - start;

      const second = yield* limiter.acquire(400).pipe(Effect.forkChild);
      yield* TestClock.adjust("19 seconds");
      const stillWaiting = yield* Effect.sync(() => second.pollUnsafe() === undefined);
      yield* TestClock.adjust("1 second");
      yield* Fiber.join(second);

      return {
        firstElapsedMillis,
        stillWaiting,
        secondElapsedMillis: (yield* Clock.currentTimeMillis) - start,
      };
    });

    const result = await Effect.runPromise(Effect.provide(program, TestClock.layer()));

    expect(result.firstElapsedMillis).toBe(0);
    expect(result.stillWaiting).toBe(true);
    expect(result.secondElapsedMillis).toBe(20_000);
  });

  it("restores a fresh 1200 budget once the 60s window rolls", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 1200 });
      const spendOneMinuteBudget = Effect.forEach(
        Array.from({ length: 12 }, (_, index) => index),
        () => limiter.acquire(100),
        { discard: true },
      );

      const start = yield* Clock.currentTimeMillis;
      const first = yield* spendOneMinuteBudget.pipe(Effect.forkChild);
      yield* TestClock.adjust("40 seconds");
      yield* Fiber.join(first);
      const firstBatchMillis = (yield* Clock.currentTimeMillis) - start;

      yield* TestClock.adjust("60 seconds");
      const rolledAt = yield* Clock.currentTimeMillis;

      const second = yield* spendOneMinuteBudget.pipe(Effect.forkChild);
      yield* TestClock.adjust("39 seconds");
      const stillWaiting = yield* Effect.sync(() => second.pollUnsafe() === undefined);
      yield* TestClock.adjust("1 second");
      yield* Fiber.join(second);

      return {
        firstBatchMillis,
        stillWaiting,
        secondBatchMillis: (yield* Clock.currentTimeMillis) - rolledAt,
      };
    });

    const result = await Effect.runPromise(Effect.provide(program, TestClock.layer()));

    // Both batches spend 1200; each is burst-bound at 40s, so the window is not
    // holding the second batch back.
    expect(result.firstBatchMillis).toBe(40_000);
    expect(result.stillWaiting).toBe(true);
    expect(result.secondBatchMillis).toBe(40_000);
  });

  it("refuses a bounded candle acquire instead of sleeping past its max wait", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 1200, burstCapacity: 100 });
      yield* limiter.acquire(100);
      const start = yield* Clock.currentTimeMillis;
      const error = yield* limiter.acquire(100, { maxWaitMillis: 2_000 }).pipe(Effect.flip);
      return { error, elapsedMillis: (yield* Clock.currentTimeMillis) - start };
    });

    const result = await Effect.runPromise(Effect.provide(program, TestClock.layer()));

    // 100 weight at 20/s needs 5s to refill, which is past the 2s bound, so the
    // acquire fails without advancing the test clock at all.
    expect(Predicate.isTagged(result.error, "RateLimitBudgetExhaustedError")).toBe(true);
    expect(result.error.message).toContain("2000ms");
    expect(result.elapsedMillis).toBe(0);
  });
});
