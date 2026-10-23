import { Context, type Effect } from "effect";
import type { Candle, CoverageResult, AggregatedMarket } from "@0xsignal/shared";
import type { AppError } from "../errors";
import type {
  CandleQuery,
  RecentCandleQuery,
  MarketTicker,
  MarketOrderBook,
  MarketTradeAnnotation,
} from "./types";

export { MarketCandleStore } from "./market-candle-store";
export { MarketProviderError } from "./market-provider.error";
export { MarketRemoteProvider } from "./market-remote-provider";

export class MarketDataService extends Context.Service<
  MarketDataService,
  {
    readonly getCandles: (
      query: CandleQuery,
    ) => Effect.Effect<
      { candles: Candle[]; provenance: string; coverage: CoverageResult },
      AppError
    >;
    readonly getRecentCandles: (
      query: RecentCandleQuery,
    ) => Effect.Effect<
      { candles: Candle[]; provenance: string; coverage: CoverageResult },
      AppError
    >;
    readonly discoverMarkets: () => Effect.Effect<readonly AggregatedMarket[], AppError>;
    readonly getTicker: (symbol: string) => Effect.Effect<MarketTicker, AppError>;
    readonly getOrderBook: (
      symbol: string,
      depth?: number | null,
    ) => Effect.Effect<MarketOrderBook, AppError>;
    readonly getTradeAnnotation: (symbol: string) => Effect.Effect<MarketTradeAnnotation, AppError>;
  }
>()("MarketDataService") {}
