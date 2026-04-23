import { Effect, Layer } from "effect";
import { MarketCandleStore, MarketRemoteProvider } from "../../application/market-data/contracts";
import { CandleRepository, CandleRepositoryLayer } from "../db/questdb/repositories/candle";
import { HyperliquidProviderLayer } from "../data-sources/hyperliquid/provider";
import { HyperliquidProvider } from "../data-sources/hyperliquid/types";
import { QuestDBClientLayer } from "../db/questdb/client";
import { HyperliquidClientLive } from "../data-sources/hyperliquid/client";

const MarketPortsLayer = Layer.mergeAll(
  Layer.effect(
    MarketCandleStore,
    Effect.gen(function* () {
      const repo = yield* CandleRepository;
      return MarketCandleStore.of({
        getCandles: (query) => repo.getCandles(query),
        checkCoverage: (symbol, exchange, timeframe, startTime, endTime) =>
          repo.checkCoverage(symbol, exchange, timeframe, startTime, endTime),
        insertCandles: (symbol, exchange, timeframe, candles) =>
          repo.insertCandles(symbol, exchange, timeframe, candles),
      });
    })
  ),
  Layer.effect(
    MarketRemoteProvider,
    Effect.gen(function* () {
      const provider = yield* HyperliquidProvider;
      return MarketRemoteProvider.of({
        getCandleSnapshot: (symbol, timeframe, startTime, endTime) =>
          provider.getCandleSnapshot(symbol, timeframe, startTime, endTime),
        getMetadata: () => provider.getMetadata(),
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
  )
);

export const MarketDataPortsLive = MarketPortsLayer.pipe(
  Layer.provide(CandleRepositoryLayer),
  Layer.provide(HyperliquidProviderLayer),
  Layer.provide(QuestDBClientLayer),
  Layer.provide(HyperliquidClientLive)
);
