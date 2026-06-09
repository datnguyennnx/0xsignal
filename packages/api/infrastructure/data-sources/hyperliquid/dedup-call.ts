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

    // Atomic check-and-set via Ref.modify — no TOCTOU race between check and register.
    // The `as` cast on an existing deferred is safe because the key uniquely identifies
    // the call type, so any Deferred stored under this key is necessarily of type T.
    const { deferred, isFirst } = yield* Ref.modify(
      dedup.registryRef,
      (map: Map<string, Deferred.Deferred<any, HyperliquidError>>) => {
        const existing = map.get(key);
        if (existing) {
          return [
            { deferred: existing as Deferred.Deferred<T, HyperliquidError>, isFirst: false },
            map,
          ];
        }
        const d = Deferred.makeUnsafe<T, HyperliquidError>();
        return [{ deferred: d, isFirst: true }, new Map(map).set(key, d)];
      }
    );

    if (isFirst) {
      // First fiber for this key — run the API call and complete the deferred
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

      yield* apiCall.pipe(
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
    }

    // All fibers (first and subsequent) wait for the shared deferred result
    return yield* Deferred.await(deferred);
  });
