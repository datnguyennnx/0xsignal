import { Context, Data, type Effect } from "effect";
import type { Candle, CoverageResult } from "@0xsignal/shared";
import type { AppError } from "../errors";
import type { AggregatedMarket } from "@0xsignal/shared";
import type {
  CandleQuery,
  RecentCandleQuery,
  MarketTicker,
  MarketOrderBook,
  MarketTradeAnnotation,
} from "./types";
import type { MarketTimeframe } from "../../domain/market-data/timeframe";

export class MarketProviderError extends Data.TaggedError("MarketProviderError")<{
  readonly kind: "NOT_FOUND" | "UPSTREAM" | "RATE_LIMITED" | "BAD_REQUEST" | "INTERNAL";
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface MarketCandleStorePort {
  readonly getCandles: (query: CandleQuery) => Effect.Effect<Candle[], MarketProviderError>;
}

export interface MarketRemoteProviderPort {
  readonly getCandleSnapshot: (
    symbol: string,
    timeframe: MarketTimeframe,
    startTime: number,
    endTime: number,
  ) => Effect.Effect<Candle[], MarketProviderError>;
  readonly getAggregatedMarkets: () => Effect.Effect<
    readonly AggregatedMarket[],
    MarketProviderError
  >;
  readonly getTicker?: (symbol: string) => Effect.Effect<MarketTicker, MarketProviderError>;
  readonly getOrderBook?: (
    symbol: string,
    depth?: number,
  ) => Effect.Effect<MarketOrderBook, MarketProviderError>;
  readonly getTradeAnnotation?: (
    symbol: string,
  ) => Effect.Effect<MarketTradeAnnotation, MarketProviderError>;
}

export class MarketCandleStore extends Context.Service<MarketCandleStore, MarketCandleStorePort>()(
  "MarketCandleStore",
) {}

export class MarketRemoteProvider extends Context.Service<
  MarketRemoteProvider,
  MarketRemoteProviderPort
>()("MarketRemoteProvider") {}

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
      depth?: number,
    ) => Effect.Effect<MarketOrderBook, AppError>;
    readonly getTradeAnnotation: (symbol: string) => Effect.Effect<MarketTradeAnnotation, AppError>;
  }
>()("MarketDataService") {}
