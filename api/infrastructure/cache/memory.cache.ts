import { Effect, Context, Layer, Schedule, Duration, Deferred, Ref } from "effect";
import { Logger } from "../logging/console.logger";

export class CacheService extends Context.Tag("CacheService")<
  CacheService,
  {
    readonly get: <T>(key: string) => Effect.Effect<T | null, never>;
    readonly set: <T>(key: string, value: T, ttl?: number) => Effect.Effect<void, never>;
    readonly getOrFetch: <T, E>(
      key: string,
      fetch: Effect.Effect<T, E>,
      ttl?: number
    ) => Effect.Effect<T, E>;
    readonly clear: () => Effect.Effect<void, never>;
    readonly size: () => Effect.Effect<number, never>;
    readonly warmup: <T, E>(
      key: string,
      fetch: Effect.Effect<T, E>,
      ttl?: number
    ) => Effect.Effect<void, never>;
  }
>() {}

interface CacheEntry<T> {
  value: T;
  expires: number;
  hits: number;
  staleAt: number; // When to start background refresh
}

// In-flight request deduplication
const inflightRequests = new Map<string, Promise<unknown>>();
const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 120000; // 2 minutes
const STALE_RATIO = 0.7; // Start background refresh at 70% of TTL
const MAX_CACHE_SIZE = 1000;

export const CacheServiceLive = Layer.effect(
  CacheService,
  Effect.gen(function* () {
    const logger = yield* Logger;

    // Cleanup expired entries using Effect.repeat
    const cleanupExpiredEntries = Effect.gen(function* () {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of cache.entries()) {
        if (now > entry.expires) {
          cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        yield* logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
      }

      // If cache is too large, remove least used entries
      if (cache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(cache.entries())
          .sort((a, b) => a[1].hits - b[1].hits)
          .slice(0, Math.floor(MAX_CACHE_SIZE * 0.2));

        entries.forEach(([key]) => cache.delete(key));
        yield* logger.debug(`Cache size limit: removed ${entries.length} least used entries`);
      }
    });

    // Fork cleanup as daemon with scheduled repeat
    yield* Effect.forkDaemon(
      cleanupExpiredEntries.pipe(
        Effect.repeat(Schedule.fixed(Duration.minutes(1))),
        Effect.catchAll(() => Effect.void)
      )
    );

    const get = <T>(key: string) =>
      Effect.sync(() => {
        const item = cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expires) {
          cache.delete(key);
          return null;
        }

        // Track cache hits
        item.hits++;

        return item.value as T;
      });

    const set = <T>(key: string, value: T, ttl = DEFAULT_TTL) =>
      Effect.sync(() => {
        const now = Date.now();
        cache.set(key, {
          value,
          expires: now + ttl,
          staleAt: now + ttl * STALE_RATIO,
          hits: 0,
        });
      });

    // Deduplicated fetch with stale-while-revalidate
    const getOrFetch = <T, E>(
      key: string,
      fetch: Effect.Effect<T, E>,
      ttl = DEFAULT_TTL
    ): Effect.Effect<T, E> =>
      Effect.gen(function* () {
        const now = Date.now();
        const item = cache.get(key) as CacheEntry<T> | undefined;

        // Fresh cache hit
        if (item && now < item.staleAt) {
          item.hits++;
          return item.value;
        }

        // Stale cache hit - return stale data and refresh in background
        if (item && now < item.expires) {
          item.hits++;

          // Background refresh (fire and forget)
          yield* Effect.forkDaemon(
            fetch.pipe(
              Effect.tap((value) => set(key, value, ttl)),
              Effect.catchAll(() => Effect.void)
            )
          );

          return item.value;
        }

        // Cache miss - deduplicate concurrent requests
        const inflight = inflightRequests.get(key);
        if (inflight) {
          const result = yield* Effect.tryPromise({
            try: () => inflight as Promise<T>,
            catch: (e) => e as E,
          });
          return result;
        }

        // Execute fetch with deduplication
        const fetchPromise = Effect.runPromise(
          fetch.pipe(
            Effect.tap((value) => set(key, value, ttl)),
            Effect.ensuring(
              Effect.sync(() => {
                inflightRequests.delete(key);
              })
            )
          )
        );

        inflightRequests.set(key, fetchPromise);

        const result = yield* Effect.tryPromise({
          try: () => fetchPromise,
          catch: (e) => e as E,
        });

        return result;
      });

    // Warmup cache in background
    const warmup = <T, E>(key: string, fetch: Effect.Effect<T, E>, ttl = DEFAULT_TTL) =>
      Effect.gen(function* () {
        const item = cache.get(key);
        if (!item || Date.now() > item.staleAt) {
          yield* Effect.forkDaemon(
            fetch.pipe(
              Effect.tap((value) => set(key, value, ttl)),
              Effect.catchAll(() => Effect.void)
            )
          );
        }
      });

    return {
      get,
      set,
      getOrFetch,
      clear: () =>
        Effect.sync(() => {
          cache.clear();
        }),
      size: () => Effect.sync(() => cache.size),
      warmup,
    };
  })
);
