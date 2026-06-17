import { Clock, Context, Duration, Effect, Ref } from "effect";
import { make as makeSemaphore } from "effect/Semaphore";
import type { Semaphore } from "effect/Semaphore";

export class HyperliquidRateLimiter extends Context.Service<
  HyperliquidRateLimiter,
  {
    readonly semaphore: Semaphore;
    readonly withRateLimit: (key: string) => Effect.Effect<void>;
  }
>()("HyperliquidRateLimiter") {}

/**
 * Creates a HyperliquidRateLimiter with:
 * - Semaphore: bounds concurrent in-flight requests (default 6)
 * - Sliding-window rate limiter: bounds requests/sec (default 10 req/s)
 */
export const makeHyperliquidRateLimiter: Effect.Effect<HyperliquidRateLimiter["Service"]> =
  Effect.gen(function* () {
    const semaphore = yield* makeSemaphore(6);
    const withRateLimit = yield* makeSlidingWindowRateLimiter({
      maxRequests: 10,
      window: Duration.seconds(1),
    });
    return HyperliquidRateLimiter.of({ semaphore, withRateLimit });
  });

/**
 * Sliding-window rate limiter built on Ref + Clock.
 * Tracks request timestamps per key and blocks when the limit is exceeded.
 */
const makeSlidingWindowRateLimiter = (options: {
  readonly maxRequests: number;
  readonly window: Duration.Input;
}): Effect.Effect<(key: string) => Effect.Effect<void>> =>
  Effect.gen(function* () {
    const windowMillis = Duration.toMillis(options.window);
    const maxRequests = options.maxRequests;
    const state = yield* Ref.make<Map<string, Array<number>>>(new Map());

    const withRateLimit = (key: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;

        const result = yield* Ref.modify(
          state,
          (
            map,
          ): readonly [
            { readonly allowed: boolean; readonly waitMs: number },
            Map<string, number[]>,
          ] => {
            const timestamps = (map.get(key) ?? []).filter((t) => now - t < windowMillis);

            if (timestamps.length >= maxRequests) {
              const oldest = timestamps[0];
              const waitMs = Math.max(1, windowMillis - (now - oldest));
              return [{ allowed: false, waitMs }, new Map(map).set(key, timestamps)];
            }

            timestamps.push(now);
            return [{ allowed: true, waitMs: 0 }, new Map(map).set(key, timestamps)];
          },
        );

        if (!result.allowed) {
          yield* Effect.sleep(Duration.millis(result.waitMs));
          return yield* withRateLimit(key);
        }
      });

    return withRateLimit;
  });
