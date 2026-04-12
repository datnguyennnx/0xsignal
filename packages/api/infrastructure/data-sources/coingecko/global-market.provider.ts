/** Global Market Provider - Market-wide metrics from CoinGecko /global endpoint */

import { Effect, Context, Layer, Cache, Schema, Duration, Schedule } from "effect";
import type { GlobalMarketData } from "@0xsignal/shared";
import { HttpClientTag } from "../../http/client";
import { RateLimiterTag } from "../../http/rate-limiter";
import { DataSourceError } from "../types";
import { API_URLS, CACHE_TTL, CACHE_CAPACITY } from "../../config/app.config";

// Schema for CoinGecko /global response
const CoinGeckoGlobalDataSchema = Schema.Struct({
  active_cryptocurrencies: Schema.Number,
  markets: Schema.Number,
  total_market_cap: Schema.Record({ key: Schema.String, value: Schema.Number }),
  total_volume: Schema.Record({ key: Schema.String, value: Schema.Number }),
  market_cap_percentage: Schema.Record({ key: Schema.String, value: Schema.Number }),
  market_cap_change_percentage_24h_usd: Schema.Number,
  updated_at: Schema.Number,
});

const CoinGeckoGlobalResponseSchema = Schema.Struct({
  data: CoinGeckoGlobalDataSchema,
});

type CoinGeckoGlobalResponse = typeof CoinGeckoGlobalResponseSchema.Type;

// Transform API response to domain type
const toGlobalMarketData = (response: CoinGeckoGlobalResponse): GlobalMarketData => ({
  totalMarketCap: response.data.total_market_cap["usd"] ?? 0,
  totalVolume24h: response.data.total_volume["usd"] ?? 0,
  btcDominance: response.data.market_cap_percentage["btc"] ?? 0,
  ethDominance: response.data.market_cap_percentage["eth"] ?? 0,
  marketCapChange24h: response.data.market_cap_change_percentage_24h_usd,
  activeCryptocurrencies: response.data.active_cryptocurrencies,
  markets: response.data.markets,
  updatedAt: response.data.updated_at,
});

const mapError = (e: unknown): DataSourceError =>
  new DataSourceError({
    source: "CoinGecko",
    message: e instanceof Error ? e.message : "Failed to fetch global market data",
  });

// Service
export class GlobalMarketService extends Context.Tag("GlobalMarketService")<
  GlobalMarketService,
  {
    readonly getGlobalMarket: () => Effect.Effect<GlobalMarketData, DataSourceError>;
  }
>() {}

export const GlobalMarketServiceLive = Layer.effect(
  GlobalMarketService,
  Effect.gen(function* () {
    const http = yield* HttpClientTag;
    const rateLimiter = yield* RateLimiterTag;

    const withRateLimit = <A, E>(effect: Effect.Effect<A, E>) =>
      rateLimiter.acquire("coingecko").pipe(
        Effect.retry({
          schedule: Schedule.exponential(Duration.millis(1000)).pipe(
            Schedule.intersect(Schedule.recurs(5))
          ),
          while: (e) => e._tag === "RateLimitExceeded",
        }),
        Effect.flatMap(() => effect)
      );

    const cache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SINGLE,
      timeToLive: CACHE_TTL.COINGECKO_TOP_CRYPTOS,
      lookup: (_: "global") =>
        Effect.gen(function* () {
          const url = `${API_URLS.COINGECKO}/global`;
          const response = yield* withRateLimit(
            http.get(url, CoinGeckoGlobalResponseSchema).pipe(Effect.mapError(mapError))
          );
          return toGlobalMarketData(response);
        }),
    });

    return {
      getGlobalMarket: () =>
        cache
          .get("global")
          .pipe(Effect.catchTag("RateLimitExceeded", (e) => Effect.fail(mapError(e)))),
    };
  })
);
