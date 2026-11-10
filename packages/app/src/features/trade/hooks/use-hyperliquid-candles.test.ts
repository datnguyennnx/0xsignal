/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { ChartDataPoint } from "@0xsignal/shared";

import { useMarketDataStore } from "@/stores/use-market-data-store";

import { cancelCandleFlush, scheduleCandleAppend } from "./use-hyperliquid-candles";

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

describe("scheduleCandleAppend", () => {
  type FrameCallback = (time: number) => void;

  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let pendingFrame: FrameCallback | null = null;

  const flushFrame = (): void => {
    const callback = pendingFrame;
    pendingFrame = null;
    callback?.(0);
  };

  const countCandleCommits = (): { count: () => number; stop: () => void } => {
    let commits = 0;
    const stop = useMarketDataStore.subscribe((state, previous) => {
      if (state.candleData !== previous.candleData) commits++;
    });
    return { count: () => commits, stop };
  };

  beforeEach(() => {
    pendingFrame = null;
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      pendingFrame = callback;
      return 1;
    };
    globalThis.cancelAnimationFrame = (): void => {
      pendingFrame = null;
    };
    useMarketDataStore.setState({ candleData: {} });
  });

  afterEach(() => {
    cancelCandleFlush();
    pendingFrame = null;
    useMarketDataStore.setState({ candleData: {} });
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  test("several frames coalesce into one store write with every bar, latest wins", () => {
    const key = "batch:1m";

    scheduleCandleAppend(key, [bar(100, 10)]);
    scheduleCandleAppend(key, [bar(100, 11), bar(200, 20)]);
    scheduleCandleAppend(key, [bar(200, 21)]);

    expect(pendingFrame).not.toBeNull();
    expect(candles(key)).toHaveLength(0);

    const commits = countCandleCommits();
    flushFrame();

    expect(commits.count()).toBe(1);
    commits.stop();
    expect(candles(key).map((candle) => candle.time)).toEqual([100, 200]);
    expect(candles(key)[0]?.close).toBe(11);
    expect(candles(key)[1]?.close).toBe(21);
  });

  test("a single message per frame still writes once", () => {
    const key = "single:1m";

    scheduleCandleAppend(key, [bar(100, 10)]);
    flushFrame();

    expect(candles(key).map((candle) => candle.time)).toEqual([100]);
  });

  test("cancelling the queued frame drops the pending batch and commits nothing", () => {
    const key = "cancel:1m";

    scheduleCandleAppend(key, [bar(100, 10)]);
    cancelCandleFlush();

    expect(pendingFrame).toBeNull();
    flushFrame();
    expect(candles(key)).toHaveLength(0);

    expect(() => cancelCandleFlush()).not.toThrow();
  });

  test("batches for different keys each get exactly one write in the frame", () => {
    const commits = countCandleCommits();

    scheduleCandleAppend("a:1m", [bar(100, 10)]);
    scheduleCandleAppend("b:1m", [bar(100, 20)]);
    scheduleCandleAppend("a:1m", [bar(200, 11)]);
    flushFrame();

    expect(commits.count()).toBe(2);
    commits.stop();
    expect(candles("a:1m").map((candle) => candle.time)).toEqual([100, 200]);
    expect(candles("b:1m").map((candle) => candle.time)).toEqual([100]);
  });
});
