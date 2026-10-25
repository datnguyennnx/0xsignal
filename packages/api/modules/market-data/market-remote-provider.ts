import { Context, type Effect } from "effect";
import type { AggregatedMarket, Candle } from "@0xsignal/shared";
import type { MarketTimeframe } from "./timeframe";
import type { MarketProviderError } from "./market-provider.error";
import type { MarketOrderBook, MarketTicker, MarketTradeAnnotation } from "./types";

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
  readonly getTicker?:
    | ((symbol: string) => Effect.Effect<MarketTicker, MarketProviderError>)
    | undefined;
  readonly getOrderBook?:
    | ((
        symbol: string,
        depth?: number | null,
      ) => Effect.Effect<MarketOrderBook, MarketProviderError>)
    | undefined;
  readonly getTradeAnnotation?:
    | ((symbol: string) => Effect.Effect<MarketTradeAnnotation, MarketProviderError>)
    | undefined;
}

export class MarketRemoteProvider extends Context.Service<
  MarketRemoteProvider,
  MarketRemoteProviderPort
>()("MarketRemoteProvider") {}
