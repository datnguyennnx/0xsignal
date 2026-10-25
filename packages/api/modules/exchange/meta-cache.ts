import { Cache, Duration, Effect } from "effect";
import type { InfoClient } from "@nktkas/hyperliquid";
import {
  acquireInfoFor,
  type HyperliquidRateLimiterService,
} from "../../integrations/hyperliquid/rate-limit";
import { HyperliquidInternalError } from "../../shared/errors";

export type MarketMeta = {
  readonly universe: ReadonlyArray<{ readonly name: string; readonly szDecimals: number }>;
};

export type MetaCache = Cache.Cache<string, MarketMeta, HyperliquidInternalError>;

export const makeMetaCache = (
  info: InfoClient,
  limiter: HyperliquidRateLimiterService,
): Effect.Effect<MetaCache> =>
  Cache.make<string, MarketMeta, HyperliquidInternalError>({
    capacity: 1,
    timeToLive: Duration.minutes(5),
    lookup: () =>
      acquireInfoFor(limiter, "meta").pipe(
        Effect.mapError(
          (error) =>
            new HyperliquidInternalError({
              message: `meta rate limited: ${error.message}`,
              cause: error,
              endpoint: "info.meta()",
            }),
        ),
        Effect.flatMap(() =>
          Effect.tryPromise({
            try: () => info.meta(),
            catch: (e) =>
              new HyperliquidInternalError({
                message: "Failed to fetch market metadata",
                cause: e,
                endpoint: "info.meta()",
              }),
          }),
        ),
      ),
  });

export const getCachedMeta = (
  cache: MetaCache,
): Effect.Effect<MarketMeta, HyperliquidInternalError> => Cache.get(cache, "meta");
