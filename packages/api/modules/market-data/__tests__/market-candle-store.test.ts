import { describe, expect, it, vi } from "vitest";
import { Effect, Schema } from "effect";
import type { DecimalString } from "@0xsignal/sdk-hyperliquid";
import type { Candle } from "@0xsignal/shared";
import { MarketTimeframeSchema } from "../timeframe";
import { makeCandleStore, sortCandlesByOpen } from "../market-candle-store";
import type { MarketRemoteProviderPort } from "../market-remote-provider";

const decimal = (value: string): DecimalString => value as DecimalString;

const timeframe = Schema.decodeUnknownSync(MarketTimeframeSchema)("1m");
const INTERVAL_MS = 60_000;
const BASE = Date.UTC(2024, 0, 1);

const candlesBetween = (start: number, end: number): Candle[] => {
  const candles: Candle[] = [];
  for (let open = start; open <= end; open += INTERVAL_MS) {
    candles.push({
      t: open,
      open: decimal("100"),
      high: decimal("110"),
      low: decimal("90"),
      close: decimal("105"),
      volume: decimal("1"),
      T: open + INTERVAL_MS - 1,
      n: 1,
      i: "1m",
      s: "BTC",
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
    expect(candles.map((candle) => candle.t)).toEqual([
      BASE,
      BASE + INTERVAL_MS,
      BASE + 2 * INTERVAL_MS,
    ]);
  });

  it("orders a shuffled provider snapshot oldest first", async () => {
    const ordered = candlesBetween(BASE, BASE + 4 * INTERVAL_MS);
    const provider: MarketRemoteProviderPort = {
      getCandleSnapshot: () =>
        Effect.succeed([ordered[3], ordered[0], ordered[4], ordered[2], ordered[1]]),
      getAggregatedMarkets: () => Effect.succeed([]),
    };
    const store = makeCandleStore(provider);

    const candles = await Effect.runPromise(store.getCandles(range(5)));

    expect(candles.map((candle) => candle.t)).toEqual([
      BASE,
      BASE + INTERVAL_MS,
      BASE + 2 * INTERVAL_MS,
      BASE + 3 * INTERVAL_MS,
      BASE + 4 * INTERVAL_MS,
    ]);
  });
});

describe("candle ordering", () => {
  const candleAt = (open: number, marker: string): Candle => ({
    t: open,
    open: decimal(marker),
    high: decimal(marker),
    low: decimal(marker),
    close: decimal(marker),
    volume: decimal("1"),
    T: open + INTERVAL_MS - 1,
    n: 1,
    i: "1m",
    s: "BTC",
  });

  it("reads each open time once and keeps equal timestamps stable", () => {
    const input = [
      candleAt(BASE + 2 * INTERVAL_MS, "4"),
      candleAt(BASE, "1"),
      candleAt(BASE + INTERVAL_MS, "2"),
      candleAt(BASE + INTERVAL_MS, "3"),
      candleAt(BASE, "0"),
    ];
    const reads = vi.fn((t: Candle["t"]) => t);

    const sorted = sortCandlesByOpen(input, reads);

    // One clock read per candle proves O(n) decoration, not O(n log n) sorting.
    expect(reads).toHaveBeenCalledTimes(input.length);
    // Equal opens retain their input order: [BASE:1, BASE:0] then [BASE+1:2, BASE+1:3].
    expect(sorted.map((candle) => candle.open)).toEqual(["1", "0", "2", "3", "4"]);
  });
});
