/** Treasury Provider - CoinGecko Public Treasury API integration */

import { Effect, Context, Layer, Cache, pipe, Array as Arr } from "effect";
import type { TreasurySummary, TreasuryChartPoint, CoinId } from "../../../domain/treasury/types";
import { TreasuryFetchError } from "../../../domain/treasury/types";
import { toHolding, toTransaction, buildSummary, toChartPoints } from "../../../domain/treasury";
import { HttpClientTag } from "../../http/client";
import { RateLimiterTag } from "../../http/rate-limiter";
import { TreasuryHoldingsByCoinSchema, TreasuryHistoricalChartSchema } from "../../http/schemas";
import { API_URLS, CACHE_TTL, CACHE_CAPACITY } from "../../config/app.config";

const mapError = (e: unknown, context: string): TreasuryFetchError =>
  new TreasuryFetchError({
    message: e instanceof Error ? `${context}: ${e.message}` : `${context}: Unknown error`,
    cause: e,
  });

/** Treasury service interface */
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

/** Live implementation */
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

    // Cache for holdings by coin
    const holdingsCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SMALL,
      timeToLive: CACHE_TTL.TREASURY_HOLDINGS,
      lookup: (coinId: string) =>
        Effect.gen(function* () {
          const url = `${API_URLS.COINGECKO}/companies/public_treasury/${coinId}`;
          const data = yield* withRateLimit(
            http
              .get(url, TreasuryHoldingsByCoinSchema)
              .pipe(Effect.mapError((e) => mapError(e, `Fetch holdings for ${coinId}`)))
          );

          // Transform to domain types
          const holdings = Arr.map(data.companies, toHolding);

          // Build summary from holdings
          const summary = buildSummary(
            coinId as CoinId,
            holdings,
            [], // Transactions fetched separately
            data.total_holdings,
            data.total_value_usd,
            data.market_cap_dominance
          );

          return summary;
        }),
    });

    // Cache for historical chart data
    const chartCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SMALL,
      timeToLive: CACHE_TTL.TREASURY_TRANSACTIONS,
      lookup: (entityId: string) =>
        Effect.gen(function* () {
          const url = `${API_URLS.COINGECKO}/public_treasury/${entityId}/chart`;
          const data = yield* withRateLimit(
            http
              .get(url, TreasuryHistoricalChartSchema)
              .pipe(Effect.mapError((e) => mapError(e, `Fetch chart for ${entityId}`)))
          );

          return toChartPoints(data.holdings, data.holding_value_in_usd);
        }),
    });

    // Supported coins (BTC/ETH are primary institutional holdings)
    const supportedCoins = ["bitcoin", "ethereum"] as const;

    return {
      getHoldingsByCoin: (coinId) => holdingsCache.get(coinId),
      getHistoricalChart: (entityId) => chartCache.get(entityId),
      getSupportedCoins: () => Effect.succeed(supportedCoins),
    };
  })
);
