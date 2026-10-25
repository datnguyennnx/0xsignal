import { Clock, Effect, Layer, Match } from "effect";
import {
  MarketCandleStore,
  MarketDataService,
  MarketProviderError,
  MarketRemoteProvider,
} from "./index";
import { makeMarketDataService } from "./service";
import { hyperliquidProviderLayer } from "../../integrations/hyperliquid/data-sources/layer";
import { HyperliquidProvider } from "../../integrations/hyperliquid/data-sources/types";
import { HyperliquidError } from "../../integrations/hyperliquid/data-sources/errors";

export const marketDataServiceLayer = Layer.effect(MarketDataService, makeMarketDataService());

export const marketCandleStoreLayer = Layer.effect(
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
            endTime,
          );
        }),
    });
  }),
);

const mapHyperliquidError = (e: HyperliquidError): MarketProviderError =>
  new MarketProviderError({
    kind: Match.value(e.kind).pipe(
      Match.when("BAD_REQUEST", () => "BAD_REQUEST" as const),
      Match.when("NOT_FOUND", () => "NOT_FOUND" as const),
      Match.when("UPSTREAM", () => "UPSTREAM" as const),
      Match.when("RATE_LIMITED", () => "RATE_LIMITED" as const),
      Match.orElse(() => "INTERNAL" as const),
    ),
    message: e.message,
    cause: e,
  });

export const marketRemoteProviderLayer = Layer.effect(
  MarketRemoteProvider,
  Effect.gen(function* () {
    const provider = yield* HyperliquidProvider;
    return MarketRemoteProvider.of({
      getCandleSnapshot: (symbol, timeframe, startTime, endTime) =>
        provider
          .getCandleSnapshot(symbol, timeframe, startTime, endTime)
          .pipe(Effect.mapError(mapHyperliquidError)),
      getAggregatedMarkets: () =>
        provider.getAggregatedMarkets().pipe(Effect.mapError(mapHyperliquidError)),
      getTicker:
        typeof provider.getTicker === "function"
          ? (symbol) => provider.getTicker(symbol).pipe(Effect.mapError(mapHyperliquidError))
          : undefined,
      getOrderBook:
        typeof provider.getOrderBook === "function"
          ? (symbol, depth) =>
              provider.getOrderBook(symbol, depth).pipe(Effect.mapError(mapHyperliquidError))
          : undefined,
      getTradeAnnotation:
        typeof provider.getTradeAnnotation === "function"
          ? (symbol) =>
              provider.getTradeAnnotation(symbol).pipe(Effect.mapError(mapHyperliquidError))
          : undefined,
    });
  }),
).pipe(Layer.provideMerge(hyperliquidProviderLayer));
