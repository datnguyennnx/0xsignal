import { Context, type Effect } from "effect";
import type {
  CandlestickRequest,
  DatasetSnapshot,
  Candle,
  CoverageResult,
} from "../../schemas/market-data";
import type { DomainError } from "../errors";
import type {
  CandleQuery,
  RecentCandleQuery,
  MarketTicker,
  MarketOrderBook,
  MarketTradeAnnotation,
  RequestCandlesticksInput,
  CreateDatasetSnapshotInput,
} from "./types";
import type { MarketTimeframe } from "../../domain/market-data/timeframe";
import type { AggregatedMarket } from "./types";

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

export class MarketDataServices extends Context.Tag("MarketDataServices")<
  MarketDataServices,
  {
    readonly requestCandlesticks: (
      input: RequestCandlesticksInput
    ) => Effect.Effect<CandlestickRequest, DomainError>;
    readonly createDatasetSnapshot: (
      input: CreateDatasetSnapshotInput
    ) => Effect.Effect<DatasetSnapshot, DomainError>;
    readonly getDatasetSnapshot: (id: string) => Effect.Effect<DatasetSnapshot, DomainError>;
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
    readonly inspectCoverage: (query: CandleQuery) => Effect.Effect<CoverageResult, DomainError>;
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
