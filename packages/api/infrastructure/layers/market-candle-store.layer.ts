import { Clock, Effect, Layer } from "effect";
import { MarketCandleStore, MarketRemoteProvider } from "../../application/market-data/contracts";

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
            endTime
          );
        }),
    });
  })
);
