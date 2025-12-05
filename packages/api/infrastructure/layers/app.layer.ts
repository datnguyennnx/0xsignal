/** Application Layer - Dependency injection composition */

import { Layer } from "effect";
import { HttpClientLive } from "../http/client";
import { RateLimiterLive } from "../http/rate-limiter";
import { RequestCacheLayer } from "../cache/request-cache";
import { AppConfigLive } from "../config/app.config";
import {
  CoinGeckoServiceLive,
  GlobalMarketServiceLive,
  CoinGeckoChartServiceLive,
} from "../data-sources/coingecko";
import { BinanceServiceLive } from "../data-sources/binance";
import { HeatmapServiceLive } from "../data-sources/heatmap";
import { DefiLlamaServiceLive } from "../data-sources/defillama";
import { AggregatedDataServiceLive } from "../data-sources/aggregator";
import { AnalysisServiceLive } from "../../services/analysis";
import { BuybackServiceLive } from "../../services/buyback";
import { ChartDataServiceLive } from "../data-sources/binance/chart.provider";
import { DevLoggerLive } from "../logging/logger";

const CoreLayer = Layer.mergeAll(DevLoggerLive, AppConfigLive);

const HttpLayer = Layer.mergeAll(HttpClientLive, RateLimiterLive);

const ChartLayer = ChartDataServiceLive.pipe(Layer.provide(HttpLayer));

const InfraLayer = Layer.mergeAll(HttpLayer, ChartLayer).pipe(Layer.provide(CoreLayer));

const CoinGeckoLayer = CoinGeckoServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const GlobalMarketLayer = GlobalMarketServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const CoinGeckoChartLayer = CoinGeckoChartServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const BinanceLayer = BinanceServiceLive.pipe(Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer)));

const DefiLlamaLayer = DefiLlamaServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer))
);

const HeatmapLayer = HeatmapServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer))
);

const AggregatedDataLayer = AggregatedDataServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer, BinanceLayer, HeatmapLayer))
);

const AnalysisLayer = AnalysisServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer))
);

const BuybackLayer = BuybackServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, CoinGeckoLayer, DefiLlamaLayer))
);

export const AppLayer = Layer.mergeAll(
  CoreLayer,
  InfraLayer,
  CoinGeckoLayer,
  GlobalMarketLayer,
  CoinGeckoChartLayer,
  BinanceLayer,
  DefiLlamaLayer,
  HeatmapLayer,
  AggregatedDataLayer,
  AnalysisLayer,
  BuybackLayer,
  RequestCacheLayer
);

export type AppLayer = typeof AppLayer;
