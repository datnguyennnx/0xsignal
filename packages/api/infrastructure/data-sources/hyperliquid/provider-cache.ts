import { Effect, Ref } from "effect";
import type { Cache } from "effect";
import { type Semaphore } from "effect/Semaphore";
import { HyperliquidError } from "./errors";
import { HyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";

export type CacheSlot<T> = {
  readonly value?: T;
  readonly expiresAt: number;
};

/**
 * Types stored in the Hyperliquid deduplication cache.
 * Enumerates all concrete API response shapes across call sites.
 */
export type DedupCacheValue =
  | string[]
  | Record<string, string>
  | ReadonlyArray<null | { readonly name: string }>
  | ReadonlyArray<[string, string]>
  | [unknown, unknown];

export type RateLimiterSvc = {
  readonly semaphore: Semaphore;
  readonly withRateLimit: (key: string) => Effect.Effect<void>;
};
export type DedupRegistrySvc = {
  readonly cache: Cache.Cache<string, DedupCacheValue, HyperliquidError, never>;
  readonly lookupRef: Ref.Ref<Map<string, Effect.Effect<DedupCacheValue, HyperliquidError>>>;
};

export const AGGREGATED_MARKETS_TTL_MS = 60_000;
export const TICKER_SNAPSHOT_TTL_MS = 30_000;

export const provideServicesFor =
  (rateLimiter: RateLimiterSvc, dedup: DedupRegistrySvc) =>
  <A, E>(
    effect: Effect.Effect<A, E, HyperliquidRateLimiter | HyperliquidDeduplicationRegistry>,
  ): Effect.Effect<A, E> =>
    effect.pipe(
      Effect.provideService(HyperliquidRateLimiter, rateLimiter),
      Effect.provideService(HyperliquidDeduplicationRegistry, dedup),
    );
