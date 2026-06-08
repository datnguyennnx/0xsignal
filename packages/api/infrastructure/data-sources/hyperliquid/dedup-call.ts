import { Deferred, Effect, Ref, Schedule } from "effect";
import { HyperliquidError, isRateLimitedCause } from "./errors";
import { HyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";

/**
 * Rate-limited, deduplicated API call.
 * - Multiple concurrent callers for the same key share a single inflight request
 * - Automatically retries on RATE_LIMITED errors with exponential backoff
 * - Cleans up the dedup registry entry after completion
 */
export const deduplicatedApiCall = <T>(
  key: string,
  call: () => Promise<T>,
  errorMessage: string
): Effect.Effect<T, HyperliquidError, HyperliquidRateLimiter | HyperliquidDeduplicationRegistry> =>
  Effect.gen(function* () {
    const rateLimiter = yield* HyperliquidRateLimiter;
    const dedup = yield* HyperliquidDeduplicationRegistry;

    const registry = yield* Ref.get(dedup.registryRef);
    const existing = registry.get(key);
    if (existing) {
      return yield* Deferred.await(existing) as Effect.Effect<any, HyperliquidError>;
    }

    const deferred = yield* Deferred.make<T, HyperliquidError>();
    yield* Ref.update(dedup.registryRef, (map) => new Map(map).set(key, deferred));

    const apiCall = rateLimiter.semaphore.withPermits(1)(
      Effect.tryPromise({
        try: call,
        catch: (cause) =>
          new HyperliquidError({
            message: errorMessage,
            kind: isRateLimitedCause(cause) ? "RATE_LIMITED" : "UPSTREAM",
            cause,
          }),
      }).pipe(
        Effect.retry({
          schedule: Schedule.exponential("1 second").pipe(Schedule.take(16)),
          while: (err) => err.kind === "RATE_LIMITED",
        })
      )
    );

    const result = yield* apiCall.pipe(
      Effect.tap((value) => Deferred.completeWith(deferred, Effect.succeed(value))),
      Effect.catch((error) =>
        Deferred.completeWith(deferred, Effect.fail(error)).pipe(
          Effect.flatMap(() => Effect.fail(error))
        )
      ),
      Effect.ensuring(
        Ref.update(dedup.registryRef, (map) => {
          const newMap = new Map(map);
          newMap.delete(key);
          return newMap;
        })
      )
    );

    return result;
  });
