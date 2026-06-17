import { Cache, Effect, Ref, Schedule } from "effect";
import { HyperliquidError, isRateLimitedCause } from "./errors";
import { HyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";
import type { DedupCacheValue } from "./provider-cache";

/**
 * Rate-limited, deduplicated API call.
 * - Multiple concurrent callers for the same key share a single inflight request
 *   via effect/Cache, which isolates each waiter's fiber so interruption of one
 *   does not affect others
 * - Automatically retries on RATE_LIMITED errors with exponential backoff
 * - Cache entries expire after 30 seconds (T-Dedup window); the lookup registry
 *   is cleaned up immediately after registration completes
 */
export const deduplicatedApiCall = <T extends DedupCacheValue>(
  key: string,
  call: () => Promise<T>,
  errorMessage: string,
): Effect.Effect<T, HyperliquidError, HyperliquidRateLimiter | HyperliquidDeduplicationRegistry> =>
  Effect.gen(function* () {
    const rateLimiter = yield* HyperliquidRateLimiter;
    const dedup = yield* HyperliquidDeduplicationRegistry;

    // Build the full effect with semaphore gate and retry logic
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
          schedule: Schedule.exponential("1 second").pipe(Schedule.take(3)),
          while: (err) => err.kind === "RATE_LIMITED",
        }),
      ),
    );

    // Register the lookup effect so the Cache's internal lookup can find it
    yield* Ref.update(dedup.lookupRef, (map) => new Map(map).set(key, apiCall));

    // Cache.get returns cached entries (within 30s TTL) or triggers the lookup.
    // For cache misses, Cache ensures concurrent callers for the same key share
    // one in-flight execution via an internal Deferred — each waiter gets its own
    // fiber, so interruption of one caller does not affect others.
    return yield* Cache.get(dedup.cache, key) as Effect.Effect<T, HyperliquidError>;
  });
