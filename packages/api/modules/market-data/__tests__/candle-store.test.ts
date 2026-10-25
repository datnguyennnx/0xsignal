import { describe, expect, it, vi } from "vitest";
import { Effect, Schema } from "effect";
import type { Candle } from "@0xsignal/shared";
import { MarketTimeframeSchema } from "../timeframe";
import { makeCandleStore } from "../market-candle-store";
import type { CandleCachePort } from "../candle-cache";
import type { MarketRemoteProviderPort } from "../market-remote-provider";

const timeframe = Schema.decodeUnknownSync(MarketTimeframeSchema)("1m");
const INTERVAL_MS = 60_000;
const BASE = Date.UTC(2024, 0, 1);

const candlesBetween = (start: number, end: number): Candle[] => {
  const candles: Candle[] = [];
  for (let open = start; open <= end; open += INTERVAL_MS) {
    candles.push({
      timestamp: new Date(open),
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 1,
    });
  }
  return candles;
};

const makeMemoryCache = (): CandleCachePort => {
  const rows = new Map<number, Candle>();
  return {
    readRange: (_symbol, _timeframe, startMs, endMs) =>
      Effect.succeed(
        [...rows.values()]
          .filter((candle) => {
            const open = new Date(candle.timestamp).getTime();
            return open >= startMs && open <= endMs;
          })
          .toSorted((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      ),
    upsert: (_symbol, _timeframe, candles) =>
      Effect.sync(() => {
        for (const candle of candles) rows.set(new Date(candle.timestamp).getTime(), candle);
      }),
  };
};

const makeProvider = (calls: Array<{ start: number; end: number }>): MarketRemoteProviderPort => ({
  getCandleSnapshot: (_symbol, _timeframe, start, end) => {
    calls.push({ start, end });
    return Effect.succeed(candlesBetween(start, end));
  },
  getAggregatedMarkets: () => Effect.succeed([]),
});

const range = (count: number) => ({
  symbol: "BTC",
  exchange: "Hyperliquid",
  timeframe,
  startTime: new Date(BASE),
  endTime: new Date(BASE + (count - 1) * INTERVAL_MS),
});

describe("market candle store caching", () => {
  it("serves a repeated range from the table after one Hyperliquid fetch", async () => {
    const calls: Array<{ start: number; end: number }> = [];
    const store = makeCandleStore(makeMemoryCache(), makeProvider(calls));

    const first = await Effect.runPromise(store.getCandles(range(350)));
    const second = await Effect.runPromise(store.getCandles(range(350)));

    expect(calls).toHaveLength(1);
    expect(first).toHaveLength(350);
    expect(second).toEqual(first);
  });

  it("fetches only the missing tail when the range is extended", async () => {
    const calls: Array<{ start: number; end: number }> = [];
    const store = makeCandleStore(makeMemoryCache(), makeProvider(calls));

    await Effect.runPromise(store.getCandles(range(350)));
    const extended = await Effect.runPromise(store.getCandles(range(360)));

    expect(calls).toHaveLength(2);
    expect(calls[1].start).toBe(BASE + 350 * INTERVAL_MS);
    expect(extended).toHaveLength(360);
  });

  it("never stores the in-progress candle", async () => {
    const cache = makeMemoryCache();
    const upsert = vi.spyOn(cache, "upsert");
    const now = Date.now();
    const open = Math.floor(now / INTERVAL_MS) * INTERVAL_MS;
    const store = makeCandleStore(cache, makeProvider([]));

    const candles = await Effect.runPromise(
      store.getCandles({
        symbol: "BTC",
        exchange: "Hyperliquid",
        timeframe,
        startTime: new Date(open),
        endTime: new Date(open),
      }),
    );

    expect(candles).toHaveLength(1);
    expect(upsert).not.toHaveBeenCalled();
  });
});
