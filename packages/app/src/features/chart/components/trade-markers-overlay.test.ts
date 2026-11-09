/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { ChartDataPoint } from "@0xsignal/shared";

import { candleMapKey } from "./trade-markers-overlay-logic";

const TIMEFRAME_SEC = 60;
const FIRST_CANDLE_SEC = 1_000_020;

const candle = (index: number, high = 101, low = 99): ChartDataPoint => ({
  time: FIRST_CANDLE_SEC + index * TIMEFRAME_SEC,
  open: 100,
  high,
  low,
  close: 100,
  volume: 1,
});

describe("candleMapKey", () => {
  test("a recreated array with identical values keeps the same key", () => {
    const candles = [candle(0), candle(1), candle(2)];
    const recreated = candles.map((entry) => ({ ...entry }));

    expect(candleMapKey(recreated)).toBe(candleMapKey(candles));
  });

  test("a moved last high changes the key so marker stacking refreshes", () => {
    const candles = [candle(0), candle(1), candle(2)];
    const ticked = [candle(0), candle(1), candle(2, 105)];

    expect(candleMapKey(ticked)).not.toBe(candleMapKey(candles));
  });

  test("a moved last low changes the key", () => {
    const candles = [candle(0), candle(1), candle(2)];
    const ticked = [candle(0), candle(1), candle(2, 101, 95)];

    expect(candleMapKey(ticked)).not.toBe(candleMapKey(candles));
  });

  test("a new bar changes the key", () => {
    const candles = [candle(0), candle(1)];
    const appended = [candle(0), candle(1), candle(2)];

    expect(candleMapKey(appended)).not.toBe(candleMapKey(candles));
  });

  test("empty and single-candle datasets have stable keys", () => {
    expect(candleMapKey([])).toBe(candleMapKey([]));
    expect(candleMapKey([candle(0)])).toBe(candleMapKey([candle(0)]));
  });
});
