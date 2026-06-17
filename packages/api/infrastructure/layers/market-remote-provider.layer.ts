import { Effect, Layer, Match } from "effect";
import { MarketRemoteProvider, MarketProviderError } from "../../application/market-data/contracts";
import { hyperliquidProviderLayer } from "../data-sources/hyperliquid/provider";
import { HyperliquidProvider } from "../data-sources/hyperliquid/types";
import { HyperliquidError } from "../data-sources/hyperliquid/errors";

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
