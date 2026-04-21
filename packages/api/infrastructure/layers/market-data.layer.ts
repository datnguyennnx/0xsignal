import { Effect, Layer } from "effect";
import {
  MarketCandleStore,
  MarketDataServicesLayer,
  MarketRemoteProvider,
} from "@application/market-data";
import {
  CandleRepository,
  CandleRepositoryLayer,
} from "@infrastructure/db/questdb/repositories/candle";
import {
  HyperliquidProvider,
  HyperliquidProviderLayer,
} from "@infrastructure/data-sources/hyperliquid/providers";
import { QuestDBClientLayer } from "@infrastructure/db/questdb/client";
import { HyperliquidClientLive } from "@infrastructure/data-sources/hyperliquid/client";
import { postgresMarketDataRepository } from "@infrastructure/repositories/market-data-repo";

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

export const makeMarketDataLayer = () =>
  MarketDataServicesLayer(postgresMarketDataRepository).pipe(
    Layer.provide(MarketPortsLayer),
    Layer.provide(CandleRepositoryLayer),
    Layer.provide(HyperliquidProviderLayer),
    Layer.provide(QuestDBClientLayer),
    Layer.provide(HyperliquidClientLive)
  );
