import { Layer } from "effect";
import { HttpServiceLive, CoinGeckoServiceLive } from "../http/http.service";
import { BubbleDetectionServiceLive } from "../../domain/services/bubble-detection";
import { MarketAnalysisServiceLive } from "../../domain/services/market-analysis";
import { ChartDataServiceLive } from "../../domain/services/chart-data.service";
import { CacheServiceLive } from "../cache/cache.service";
import { LoggerLiveDefault } from "../logging/logger.service";

// Compose all application layers with proper dependency order
// Layer 1: Base services (no dependencies)
const BaseLayer = Layer.mergeAll(
  HttpServiceLive,
  BubbleDetectionServiceLive,
  CacheServiceLive,
  LoggerLiveDefault,
  ChartDataServiceLive
);

// Layer 2: Services that depend on HttpService
const DataLayer = CoinGeckoServiceLive.pipe(Layer.provide(BaseLayer));

// Layer 3: Market Analysis Service (depends on CoinGecko, BubbleDetection, Cache, and Logger)
const MarketAnalysisLayer = MarketAnalysisServiceLive.pipe(
  Layer.provide(Layer.mergeAll(BaseLayer, DataLayer))
);

// Final composed layer - merge all layers so all services are available
export const AppLayer = Layer.mergeAll(BaseLayer, DataLayer, MarketAnalysisLayer);
