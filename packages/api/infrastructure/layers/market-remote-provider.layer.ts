import { Effect, Layer } from "effect";
import { MarketRemoteProvider } from "../../application/market-data/contracts";
import { hyperliquidProviderLayer } from "../data-sources/hyperliquid/provider";
import { HyperliquidProvider } from "../data-sources/hyperliquid/types";

export const marketRemoteProviderLayer = Layer.effect(
  MarketRemoteProvider,
  Effect.gen(function* () {
    const provider = yield* HyperliquidProvider;
    return MarketRemoteProvider.of({
      getCandleSnapshot: (symbol, timeframe, startTime, endTime) =>
        provider.getCandleSnapshot(symbol, timeframe, startTime, endTime),
      getAggregatedMarkets: () => provider.getAggregatedMarkets(),
      getTicker:
        typeof provider.getTicker === "function"
          ? (symbol) => provider.getTicker(symbol)
          : undefined,
      getOrderBook:
        typeof provider.getOrderBook === "function"
          ? (symbol, depth) => provider.getOrderBook(symbol, depth)
          : undefined,
      getTradeAnnotation:
        typeof provider.getTradeAnnotation === "function"
          ? (symbol) => provider.getTradeAnnotation(symbol)
          : undefined,
    });
  }),
).pipe(Layer.provideMerge(hyperliquidProviderLayer));
