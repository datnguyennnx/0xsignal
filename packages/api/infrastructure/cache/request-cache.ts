/** Cache Configuration - Centralized request caching with Effect */

import { Effect, Layer, Request, Duration } from "effect";

export interface CacheConfig {
  readonly capacity: number;
  readonly timeToLive: Duration.DurationInput;
}

export const REQUEST_CACHE_CONFIG: CacheConfig = {
  capacity: 512,
  timeToLive: Duration.minutes(5),
};

export const RequestCacheLayer = Layer.setRequestCache(
  Request.makeCache({
    capacity: REQUEST_CACHE_CONFIG.capacity,
    timeToLive: REQUEST_CACHE_CONFIG.timeToLive,
  })
);

export const withCaching = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.withRequestCaching(true));

export const withoutCaching = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.withRequestCaching(false));
