import { Clock, Context, Effect } from "effect";
import type { Candle } from "@0xsignal/shared";
import type { MarketProviderError } from "./market-provider.error";
import type { MarketRemoteProviderPort } from "./market-remote-provider";
import type { CandleQuery } from "./types";
import { getTimeframeMs } from "./timeframe";

export interface MarketCandleStorePort {
  readonly getCandles: (query: CandleQuery) => Effect.Effect<Candle[], MarketProviderError>;
}

export class MarketCandleStore extends Context.Service<MarketCandleStore, MarketCandleStorePort>()(
  "MarketCandleStore",
) {}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const openMillis = (timestamp: Candle["timestamp"]): number => new Date(timestamp).getTime();

/**
 * Sorts oldest first with one clock read per candle. Decorating before the
 * comparison keeps `Date` construction linear instead of once per comparison.
 * `toSorted`/`sort` is stable, so equal timestamps keep their input order.
 */
export const sortCandlesByOpen = (
  candles: readonly Candle[],
  toOpenMillis: (timestamp: Candle["timestamp"]) => number = openMillis,
): Candle[] => {
  const decorated = candles.map((candle) => ({
    candle,
    open: toOpenMillis(candle.timestamp),
  }));
  decorated.sort((a, b) => a.open - b.open);
  return decorated.map((entry) => entry.candle);
};

/**
 * Candles are not persisted, so every read is one provider snapshot. The range
 * is snapped to open times first: the provider charges for the candles it is
 * asked for, and a sub-interval bound would otherwise buy an extra full candle.
 */
export const makeCandleStore = (provider: MarketRemoteProviderPort): MarketCandleStorePort => ({
  getCandles: (query) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const intervalMs = getTimeframeMs(query.timeframe);
      const startOpen =
        Math.ceil((query.startTime?.getTime() ?? now - ONE_DAY_MS) / intervalMs) * intervalMs;
      const endOpen = Math.floor((query.endTime?.getTime() ?? now) / intervalMs) * intervalMs;

      if (startOpen > endOpen) return [];

      const candles = yield* provider.getCandleSnapshot(
        query.symbol,
        query.timeframe,
        startOpen,
        endOpen + intervalMs - 1,
      );

      return sortCandlesByOpen(
        candles.filter((candle) => {
          const open = openMillis(candle.timestamp);
          return open >= startOpen && open <= endOpen;
        }),
      );
    }),
});
