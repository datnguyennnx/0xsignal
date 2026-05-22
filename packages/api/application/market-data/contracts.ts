import { Context, type Effect } from "effect";
import type { Candle, CoverageResult } from "@0xsignal/shared";
import type { DomainError } from "../errors";
import type { AggregatedMarket } from "@0xsignal/shared";
import type {
  CandleQuery,
  RecentCandleQuery,
  MarketTicker,
  MarketOrderBook,
  MarketTradeAnnotation,
} from "./types";
import type { MarketTimeframe } from "../../domain/market-data/timeframe";

export interface MarketCandleStorePort {
  readonly getCandles: (query: CandleQuery) => Effect.Effect<Candle[], unknown>;
  readonly checkCoverage: (
    symbol: string,
    exchange: string,
    timeframe: MarketTimeframe,
    startTime: Date,
    endTime: Date
  ) => Effect.Effect<CoverageResult, unknown>;
  readonly insertCandles: (
    symbol: string,
    exchange: string,
    timeframe: MarketTimeframe,
    candles: Candle[]
  ) => Effect.Effect<void, unknown>;
}

export interface MarketRemoteProviderPort {
  readonly getCandleSnapshot: (
    symbol: string,
    timeframe: MarketTimeframe,
    startTime: number,
    endTime: number
  ) => Effect.Effect<Candle[], unknown>;
  readonly getAggregatedMarkets: () => Effect.Effect<readonly AggregatedMarket[], unknown>;
  readonly getTicker?: (symbol: string) => Effect.Effect<MarketTicker, unknown>;
  readonly getOrderBook?: (
    symbol: string,
    depth?: number
  ) => Effect.Effect<MarketOrderBook, unknown>;
  readonly getTradeAnnotation?: (symbol: string) => Effect.Effect<MarketTradeAnnotation, unknown>;
}

export class MarketCandleStore extends Context.Tag("MarketCandleStore")<
  MarketCandleStore,
  MarketCandleStorePort
>() {}

export class MarketRemoteProvider extends Context.Tag("MarketRemoteProvider")<
  MarketRemoteProvider,
  MarketRemoteProviderPort
>() {}

export class MarketDataService extends Context.Tag("MarketDataService")<
  MarketDataService,
  {
    readonly getCandles: (
      query: CandleQuery
    ) => Effect.Effect<
      { candles: Candle[]; provenance: string; coverage: CoverageResult },
      DomainError
    >;
    readonly getRecentCandles: (
      query: RecentCandleQuery
    ) => Effect.Effect<
      { candles: Candle[]; provenance: string; coverage: CoverageResult },
      DomainError
    >;
    readonly discoverMarkets: () => Effect.Effect<unknown, DomainError>;
    readonly getTicker: (symbol: string) => Effect.Effect<MarketTicker, DomainError>;
    readonly getOrderBook: (
      symbol: string,
      depth?: number
    ) => Effect.Effect<MarketOrderBook, DomainError>;
    readonly getTradeAnnotation: (
      symbol: string
    ) => Effect.Effect<MarketTradeAnnotation, DomainError>;
  }
>() {}
