import { Effect, Cache, Duration } from "effect";
import type { ApiError, NetworkError } from "../api/errors";

const CACHE_TTL = Duration.minutes(2);
const CACHE_CAPACITY = 100;

export const createQueryCache = <K, V, E = ApiError | NetworkError>(
  lookup: (key: K) => Effect.Effect<V, E>
) =>
  Cache.make({
    capacity: CACHE_CAPACITY,
    timeToLive: CACHE_TTL,
    lookup,
  });

export const createInfiniteCache = <K, V, E = ApiError | NetworkError>(
  lookup: (key: K) => Effect.Effect<V, E>
) =>
  Cache.make({
    capacity: CACHE_CAPACITY,
    timeToLive: Duration.infinity,
    lookup,
  });
