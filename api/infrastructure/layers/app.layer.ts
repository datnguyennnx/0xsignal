import { Layer } from "effect";
import { HttpServiceLive, CoinGeckoServiceLive } from "../http/http.service";
import { MarketAnalysisServiceLive } from "../../domain/services/market-analysis";
import { ChartDataServiceLive } from "../../domain/services/chart-data.service";
import { CacheServiceLive } from "../cache/cache.service";
import { LoggerLiveDefault } from "../logging/logger.service";

// Compose all application layers with proper dependency order
// Layer 1: Core services (no dependencies)
const CoreLayer = Layer.mergeAll(LoggerLiveDefault);

// Layer 2: Services that depend on Logger
const InfraLayer = Layer.mergeAll(HttpServiceLive, CacheServiceLive, ChartDataServiceLive).pipe(
  Layer.provide(CoreLayer)
);

// Layer 3: Services that depend on HttpService
const DataLayer = CoinGeckoServiceLive.pipe(Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer)));

// Layer 4: Market Analysis Service (depends on CoinGecko, Cache, and Logger)
const MarketAnalysisLayer = MarketAnalysisServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, DataLayer))
);

// Final composed layer - merge all layers so all services are available
export const AppLayer = Layer.mergeAll(CoreLayer, InfraLayer, DataLayer, MarketAnalysisLayer);
