import { Effect, Context, Layer, Schedule, Duration } from "effect";
import { Logger } from "../logging/console.logger";

export class CacheService extends Context.Tag("CacheService")<
  CacheService,
  {
    readonly get: <T>(key: string) => Effect.Effect<T | null, never>;
    readonly set: <T>(key: string, value: T, ttl?: number) => Effect.Effect<void, never>;
    readonly clear: () => Effect.Effect<void, never>;
    readonly size: () => Effect.Effect<number, never>;
  }
>() {}

interface CacheEntry<T> {
  value: T;
  expires: number;
  hits: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 120000; // 2 minutes
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

    return {
      get: <T>(key: string) =>
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
        }),

      set: <T>(key: string, value: T, ttl = DEFAULT_TTL) =>
        Effect.sync(() => {
          cache.set(key, {
            value,
            expires: Date.now() + ttl,
            hits: 0,
          });
        }),

      clear: () =>
        Effect.sync(() => {
          cache.clear();
        }),

      size: () => Effect.sync(() => cache.size),
    };
  })
);
