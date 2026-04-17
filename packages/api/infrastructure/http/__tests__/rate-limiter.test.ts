import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { RateLimiterTag, RateLimiterLive, RateLimitExceeded } from "../rate-limiter";

describe("RateLimiter", () => {
  it("does not oversubscribe burst tokens under concurrency", async () => {
    const program = Effect.gen(function* () {
      const limiter = yield* RateLimiterTag;
      const attempts = Array.from({ length: 25 }, () =>
        limiter.acquire("test-source").pipe(
          Effect.match({
            onSuccess: () => "ok" as const,
            onFailure: (error) => {
              if (error instanceof RateLimitExceeded) {
                return "limited" as const;
              }
              return "limited" as const;
            },
          })
        )
      );

      return yield* Effect.all(attempts, { concurrency: "unbounded" });
    }).pipe(Effect.provide(RateLimiterLive));

    const results = await Effect.runPromise(program);
    const successCount = results.filter((value) => value === "ok").length;

    expect(successCount).toBeLessThanOrEqual(20);
    expect(results.length).toBe(25);
  });
});
