/** Treasury Provider - CoinGecko Public Treasury API integration */

import { Effect, Context, Layer, Cache, pipe, Array as Arr } from "effect";
import type { TreasurySummary, TreasuryChartPoint, CoinId } from "../../../domain/treasury/types";
import { TreasuryFetchError } from "../../../domain/treasury/types";
import { toHolding, buildSummary, toChartPoints } from "../../../domain/treasury";
import { HttpClientTag } from "../../http/client";
import { RateLimiterTag } from "../../http/rate-limiter";
import { TreasuryHoldingsByCoinSchema, TreasuryHistoricalChartSchema } from "../../http/schemas";
import { API_URLS, CACHE_TTL, CACHE_CAPACITY } from "../../config/app.config";

const mapError = (e: unknown, context: string): TreasuryFetchError =>
  new TreasuryFetchError({
    message: e instanceof Error ? `${context}: ${e.message}` : `${context}: Unknown error`,
    cause: e,
  });

// Default coins with known institutional holdings
const DEFAULT_TREASURY_COINS = ["bitcoin", "ethereum"] as const;

export class TreasuryService extends Context.Tag("TreasuryService")<
  TreasuryService,
  {
    readonly getHoldingsByCoin: (
      coinId: string
    ) => Effect.Effect<TreasurySummary, TreasuryFetchError>;
    readonly getHistoricalChart: (
      entityId: string
    ) => Effect.Effect<readonly TreasuryChartPoint[], TreasuryFetchError>;
    readonly getSupportedCoins: () => Effect.Effect<readonly string[], never>;
  }
>() {}

// Build empty summary for coins with no institutional data
const buildEmptySummary = (coinId: string): TreasurySummary =>
  buildSummary(coinId as CoinId, [], [], 0, 0, 0);

export const TreasuryServiceLive = Layer.effect(
  TreasuryService,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;
    const rateLimiter = yield* RateLimiterTag;

    const withRateLimit = <A, E>(effect: Effect.Effect<A, E>) =>
      pipe(
        rateLimiter.acquire("coingecko"),
        Effect.flatMap(() => effect),
        Effect.catchAll(() => effect)
      );

    // Holdings cache with graceful empty fallback
    const holdingsCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SMALL,
      timeToLive: CACHE_TTL.TREASURY_HOLDINGS,
      lookup: (coinId: string) =>
        pipe(
          withRateLimit(
            http.get(
              `${API_URLS.COINGECKO}/companies/public_treasury/${coinId}`,
              TreasuryHoldingsByCoinSchema
            )
          ),
          Effect.map((data) => {
            const holdings = Arr.map(data.companies, toHolding);
            return buildSummary(
              coinId as CoinId,
              holdings,
              [],
              data.total_holdings,
              data.total_value_usd,
              data.market_cap_dominance
            );
          }),
          Effect.catchAll(() => Effect.succeed(buildEmptySummary(coinId)))
        ),
    });

    // Historical chart cache with graceful empty fallback
    const chartCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SMALL,
      timeToLive: CACHE_TTL.TREASURY_TRANSACTIONS,
      lookup: (entityId: string) =>
        pipe(
          withRateLimit(
            http.get(
              `${API_URLS.COINGECKO}/public_treasury/${entityId}/chart`,
              TreasuryHistoricalChartSchema
            )
          ),
          Effect.map((data) => toChartPoints(data.holdings, data.holding_value_in_usd)),
          Effect.catchAll(() => Effect.succeed([] as readonly TreasuryChartPoint[]))
        ),
    });

    return {
      getHoldingsByCoin: (coinId) => holdingsCache.get(coinId),
      getHistoricalChart: (entityId) => chartCache.get(entityId),
      getSupportedCoins: () => Effect.succeed(DEFAULT_TREASURY_COINS),
    };
  })
);
