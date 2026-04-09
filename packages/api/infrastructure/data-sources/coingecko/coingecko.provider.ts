/** CoinGecko Provider - Spot price data with caching and rate limiting */

import { Effect, Context, Layer, Data, Cache, Schedule, Duration, Array as Arr } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { HttpClientTag } from "../../http/client";
import { RateLimiterTag } from "../../http/rate-limiter";
import { CoinGeckoMarketsSchema, type CoinGeckoMarketItem } from "../../http/schemas";
import { DataSourceError, type AdapterInfo } from "../types";
import {
  API_URLS,
  CACHE_TTL,
  CACHE_CAPACITY,
  RATE_LIMITS,
  DEFAULT_LIMITS,
} from "../../config/app.config";

export const COINGECKO_INFO: AdapterInfo = {
  name: "CoinGecko",
  version: "1.0.0",
  capabilities: {
    spotPrices: true,
    futuresPrices: false,

    openInterest: false,
    fundingRates: false,
    heatmap: false,
    historicalData: true,
    realtime: false,
  },
  rateLimit: { requestsPerMinute: RATE_LIMITS.COINGECKO },
};

const toCryptoPrice = (coin: CoinGeckoMarketItem): CryptoPrice => ({
  id: coin.id,
  symbol: coin.symbol,
  name: coin.name,
  image: coin.image,
  price: coin.current_price,
  marketCap: coin.market_cap,
  volume24h: coin.total_volume,
  change1h: coin.price_change_percentage_1h_in_currency ?? 0,
  change24h: coin.price_change_percentage_24h ?? 0,
  change7d: coin.price_change_percentage_7d_in_currency ?? 0,
  sparkline7d: coin.sparkline_in_7d?.price ?? [],
  timestamp: new Date(coin.last_updated),
  high24h: coin.high_24h ?? undefined,
  low24h: coin.low_24h ?? undefined,
  circulatingSupply: coin.circulating_supply ?? undefined,
  totalSupply: coin.total_supply ?? undefined,
  maxSupply: coin.max_supply ?? undefined,
  ath: coin.ath ?? undefined,
  athChangePercentage: coin.ath_change_percentage ?? undefined,
  atl: coin.atl ?? undefined,
  atlChangePercentage: coin.atl_change_percentage ?? undefined,
});

const mapError = (e: unknown, symbol?: string): DataSourceError =>
  new DataSourceError({
    source: "CoinGecko",
    message: e instanceof Error ? e.message : "Unknown error",
    symbol,
  });

export class CoinGeckoService extends Context.Tag("CoinGeckoService")<
  CoinGeckoService,
  {
    readonly info: AdapterInfo;
    readonly getTopCryptos: (limit?: number) => Effect.Effect<CryptoPrice[], DataSourceError>;
  }
>() {}

export const CoinGeckoServiceLive = Layer.effect(
  CoinGeckoService,
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

    const topCryptosCache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SINGLE,
      timeToLive: CACHE_TTL.COINGECKO_TOP_CRYPTOS,
      lookup: (limit: number) =>
        Effect.gen(function* () {
          const url = `${API_URLS.COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=1h,24h,7d`;
          const data = yield* withRateLimit(
            http.get(url, CoinGeckoMarketsSchema).pipe(Effect.mapError(mapError))
          );
          const cryptos = Arr.map(data, toCryptoPrice);
          return cryptos;
        }),
    });

    return {
      info: COINGECKO_INFO,
      getTopCryptos: (limit = DEFAULT_LIMITS.TOP_CRYPTOS) =>
        topCryptosCache
          .get(limit)
          .pipe(Effect.catchTag("RateLimitExceeded", (e) => Effect.fail(mapError(e)))),
    };
  })
);
