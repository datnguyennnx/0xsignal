import { Deferred, Effect, Ref } from "effect";
import { type Semaphore } from "effect/Semaphore";
import { HyperliquidError } from "./errors";
import { HyperliquidRateLimiter } from "./rate-limiter";
import { HyperliquidDeduplicationRegistry } from "./dedup";

export type CacheSlot<T> = {
  readonly value?: T;
  readonly expiresAt: number;
};

export type RateLimiterSvc = { readonly semaphore: Semaphore };
export type DedupRegistrySvc = {
  readonly registryRef: Ref.Ref<Map<string, Deferred.Deferred<any, HyperliquidError>>>;
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
