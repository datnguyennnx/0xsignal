import { describe, expect, it } from "vitest";
import { Clock, Effect, Fiber, Predicate } from "effect";
import { TestClock } from "effect/testing";
import { makeLimiter, RateLimitBudgetExhaustedError } from "../rate-limit";

describe("HyperliquidRateLimiter", () => {
  it("serves two weighted acquires then makes the next one wait a second's shortfall", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 1200 });
      const start = yield* Clock.currentTimeMillis;

      const first = yield* limiter.acquire(10).pipe(Effect.forkChild);
      const second = yield* limiter.acquire(10).pipe(Effect.forkChild);
      yield* TestClock.adjust("1 second");
      yield* Fiber.join(first);
      yield* Fiber.join(second);
      const afterTwo = yield* Clock.currentTimeMillis;

      const third = yield* limiter.acquire(10).pipe(Effect.forkChild);
      yield* TestClock.adjust("500 millis");
      yield* Fiber.join(third);
      const afterThird = yield* Clock.currentTimeMillis;

      return { firstTwo: afterTwo - start, third: afterThird - afterTwo };
    });

    const timing = await Effect.runPromise(Effect.provide(program, TestClock.layer()));

    expect(timing.firstTwo).toBe(1000);
    expect(timing.third).toBe(500);
  });

  it("fails with the tagged error instead of waiting when weight exceeds the ceiling", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* makeLimiter({ perSecond: 20, perMinute: 100 });
      return yield* limiter.acquire(150).pipe(Effect.flip);
    });

    const error = await Effect.runPromise(program);

    expect(error instanceof RateLimitBudgetExhaustedError).toBe(true);
    expect(Predicate.isTagged(error, "RateLimitBudgetExhaustedError")).toBe(true);
    expect(error.weight).toBe(150);
    expect(error.capacityPerMin).toBe(100);
    expect(error.message).toContain("per-minute ceiling 100");
  });

  it("names the per-second ceiling when only that limit is exceeded", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* makeLimiter({ perSecond: 1, perMinute: 60 });
      return yield* limiter.acquire(2).pipe(Effect.flip);
    });

    const error = await Effect.runPromise(program);

    expect(Predicate.isTagged(error, "RateLimitBudgetExhaustedError")).toBe(true);
    expect(error.weight).toBe(2);
    expect(error.message).toContain("per-second ceiling 1");
    expect(error.message).not.toContain("per-minute");
  });

  it("fails fast instead of deadlocking when weight exceeds the per-second ceiling", async () => {
    const startedAt = Date.now();
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const limiter = yield* makeLimiter({ perSecond: 1, perMinute: 60 });
        const error = yield* limiter.acquire(2).pipe(Effect.timeout("1 second"), Effect.flip);
        return error;
      }),
    );
    const elapsedMillis = Date.now() - startedAt;

    expect(Predicate.isTagged(outcome, "RateLimitBudgetExhaustedError")).toBe(true);
    expect(outcome.message).toContain("per-second ceiling 1");
    expect(elapsedMillis).toBeLessThan(1000);
  });
});
