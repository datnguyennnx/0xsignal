import { describe, expect, it } from "vitest";
import { Effect, Schema } from "effect";
import type { Candle } from "@0xsignal/shared";
import { MarketTimeframeSchema } from "../timeframe";
import { makeCandleStore } from "../market-candle-store";
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

describe("market candle store", () => {
  it("fetches every request from the provider — nothing is cached across calls", async () => {
    const calls: Array<{ start: number; end: number }> = [];
    const store = makeCandleStore(makeProvider(calls));

    const first = await Effect.runPromise(store.getCandles(range(350)));
    const second = await Effect.runPromise(store.getCandles(range(350)));

    expect(calls).toHaveLength(2);
    expect(first).toHaveLength(350);
    expect(second).toEqual(first);
  });

  it("returns only the candles inside the requested range, oldest first", async () => {
    const calls: Array<{ start: number; end: number }> = [];
    const store = makeCandleStore(makeProvider(calls));

    const candles = await Effect.runPromise(store.getCandles(range(3)));

    expect(candles).toHaveLength(3);
    expect(candles.map((candle) => new Date(candle.timestamp).getTime())).toEqual([
      BASE,
      BASE + INTERVAL_MS,
      BASE + 2 * INTERVAL_MS,
    ]);
  });
});
