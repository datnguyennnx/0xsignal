import { Layer } from "effect";
import { HttpServiceLive, CoinGeckoServiceLive } from "../market-data/coingecko.adapter";
import { AnalysisServiceLive } from "../../services/analysis";
import { ChartDataServiceLive } from "../../application/stream-chart-data";
import { CacheServiceLive } from "../cache/memory.cache";
import { LoggerLiveDefault } from "../logging/console.logger";

const CoreLayer = Layer.mergeAll(LoggerLiveDefault);

const InfraLayer = Layer.mergeAll(HttpServiceLive, CacheServiceLive, ChartDataServiceLive).pipe(
  Layer.provide(CoreLayer)
);

const DataLayer = CoinGeckoServiceLive.pipe(Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer)));

const AnalysisLayer = AnalysisServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, InfraLayer, DataLayer))
);

export const AppLayer = Layer.mergeAll(CoreLayer, InfraLayer, DataLayer, AnalysisLayer);
