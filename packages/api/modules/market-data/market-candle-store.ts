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

const openMillis = (t: number): number => t;

/**
 * Sorts oldest first with one open-time read per candle. Decorating before the
 * comparison keeps that read linear instead of once per comparison.
 * `toSorted`/`sort` is stable, so equal timestamps keep their input order.
 */
export const sortCandlesByOpen = (
  candles: readonly Candle[],
  toOpenMillis: (t: Candle["t"]) => number = openMillis,
): Candle[] => {
  const decorated = candles.map((candle) => ({
    candle,
    open: toOpenMillis(candle.t),
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
          const open = openMillis(candle.t);
          return open >= startOpen && open <= endOpen;
        }),
      );
    }),
});
