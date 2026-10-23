/// <reference types="bun-types" />
import { beforeEach, describe, expect, test } from "bun:test";

import type { ChartDataPoint } from "@0xsignal/shared";

import { useMarketDataStore } from "./use-market-data-store";

const bar = (time: number, close: number): ChartDataPoint => ({
  time,
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  volume: 100,
});

const candles = (key: string): readonly ChartDataPoint[] =>
  useMarketDataStore.getState().candleData[key] ?? [];

describe("appendCandles", () => {
  beforeEach(() => {
    useMarketDataStore.setState({ candleData: {} });
  });

  test("merges a newer sorted batch without dropping history", () => {
    const key = "merge:1m";

    useMarketDataStore.getState().setCandleData(key, [bar(100, 10), bar(200, 20)]);
    useMarketDataStore.getState().appendCandles(key, [bar(150, 15), bar(250, 25)]);

    expect(candles(key).map((candle) => candle.time)).toEqual([100, 150, 200, 250]);
  });

  test("keeps one bar per timestamp and lets the newer payload win", () => {
    const key = "dedupe:1m";

    useMarketDataStore.getState().setCandleData(key, [bar(100, 10), bar(200, 20)]);
    useMarketDataStore.getState().appendCandles(key, [bar(200, 99), bar(300, 30)]);

    const result = candles(key);
    expect(result.map((candle) => candle.time)).toEqual([100, 200, 300]);
    expect(result[1]?.close).toBe(99);
  });

  test("replaces the last bar in place when the stream updates it", () => {
    const key = "last:1m";

    useMarketDataStore.getState().setCandleData(key, [bar(100, 10), bar(200, 20)]);
    useMarketDataStore.getState().appendCandles(key, [bar(200, 21)]);

    expect(candles(key).map((candle) => candle.time)).toEqual([100, 200]);
    expect(candles(key)[1]?.close).toBe(21);
  });
});
