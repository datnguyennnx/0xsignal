import { Layer } from "effect";
import {
  HttpServiceLive,
  CoinGeckoServiceLive,
  BubbleDetectionServiceLive,
} from "@0xsignal/shared";
import { MarketAnalysisServiceLive } from "../../domain/services/market-analysis";
import { CacheServiceLive } from "../cache/cache.service";
import { LoggerLiveDefault } from "../logging/logger.service";

// Compose all application layers with proper dependency order
// Layer 1: Base services (no dependencies)
const BaseLayer = Layer.mergeAll(
  HttpServiceLive,
  BubbleDetectionServiceLive,
  CacheServiceLive,
  LoggerLiveDefault
);

// Layer 2: Services that depend on HttpService
const DataLayer = CoinGeckoServiceLive.pipe(Layer.provide(BaseLayer));

// Layer 3: Market Analysis Service (depends on CoinGecko, BubbleDetection, Cache, and Logger)
const MarketAnalysisLayer = MarketAnalysisServiceLive.pipe(
  Layer.provide(Layer.mergeAll(BaseLayer, DataLayer))
);

// Final composed layer - merge all layers so all services are available
export const AppLayer = Layer.mergeAll(
  BaseLayer,
  DataLayer,
  MarketAnalysisLayer
);
