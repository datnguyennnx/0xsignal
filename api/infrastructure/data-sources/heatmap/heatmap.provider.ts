/** Heatmap Provider - Market heatmap with caching */

import { Effect, Context, Layer, Cache } from "effect";
import type { MarketHeatmap, HeatmapConfig } from "@0xsignal/shared";
import { CoinGeckoService } from "../coingecko";
import { DataSourceError, type AdapterInfo } from "../types";
import { createMarketHeatmap } from "../../../domain/heatmap";
import { CACHE_TTL, CACHE_CAPACITY, RATE_LIMITS } from "../../config/app.config";

export const HEATMAP_INFO: AdapterInfo = {
  name: "Heatmap",
  version: "1.0.0",
  capabilities: {
    spotPrices: false,
    futuresPrices: false,
    liquidations: false,
    openInterest: false,
    fundingRates: false,
    heatmap: true,
    historicalData: false,
    realtime: false,
  },
  rateLimit: { requestsPerMinute: RATE_LIMITS.DEFILLAMA },
};

export class HeatmapService extends Context.Tag("HeatmapService")<
  HeatmapService,
  {
    readonly info: AdapterInfo;
    readonly getMarketHeatmap: (
      config: HeatmapConfig
    ) => Effect.Effect<MarketHeatmap, DataSourceError>;
  }
>() {}

export const HeatmapServiceLive = Layer.effect(
  HeatmapService,
  Effect.gen(function* () {
    const coinGecko = yield* CoinGeckoService;

    const cache = yield* Cache.make({
      capacity: CACHE_CAPACITY.SMALL,
      timeToLive: CACHE_TTL.HEATMAP,
      lookup: (key: string) =>
        Effect.gen(function* () {
          const [limitStr, sortBy, category, metric] = key.split(":");
          const prices = yield* coinGecko.getTopCryptos(parseInt(limitStr, 10));
          return createMarketHeatmap(prices, {
            limit: parseInt(limitStr, 10),
            sortBy: sortBy as HeatmapConfig["sortBy"],
            category: category !== "undefined" ? category : undefined,
            metric: (metric as HeatmapConfig["metric"]) || "change24h",
          });
        }),
    });

    return {
      info: HEATMAP_INFO,
      getMarketHeatmap: (config) =>
        cache.get(`${config.limit}:${config.sortBy}:${config.category}:${config.metric}`),
    };
  })
);
