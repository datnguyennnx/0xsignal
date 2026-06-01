import { Clock, Effect, Layer } from "effect";
import { MarketCandleStore, MarketRemoteProvider } from "../../application/market-data/contracts";
import { hyperliquidProviderLayer } from "../data-sources/hyperliquid/provider";
import { HyperliquidProvider } from "../data-sources/hyperliquid/types";

const marketRemoteProviderLayer = Layer.effect(
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
  })
);

const marketCandleStoreLayer = Layer.effect(
  MarketCandleStore,
  Effect.gen(function* () {
    const provider = yield* MarketRemoteProvider;
    return MarketCandleStore.of({
      getCandles: (query) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;
          const startTime = query.startTime?.getTime() ?? now - 24 * 60 * 60 * 1000;
          const endTime = query.endTime?.getTime() ?? now;
          return yield* provider.getCandleSnapshot(
            query.symbol,
            query.timeframe,
            startTime,
            endTime
          );
        }),
      checkCoverage: () =>
        Effect.succeed({
          hasData: true,
          rowCount: 1,
          expectedCount: 1,
          fullCoverage: true,
          missingWindows: [],
        }),
      insertCandles: () => Effect.void,
    });
  })
);

const mergedMarketLayers = Layer.merge(
  marketRemoteProviderLayer,
  marketCandleStoreLayer.pipe(Layer.provide(marketRemoteProviderLayer))
);

export const marketDataInfrastructureLayer = mergedMarketLayers.pipe(
  Layer.provideMerge(hyperliquidProviderLayer)
);
