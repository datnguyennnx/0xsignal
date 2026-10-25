/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { ChartDataPoint } from "@0xsignal/shared";

import type { L2BookLevel } from "@/core/utils/hyperliquid";

import { useMarketDataStore } from "./use-market-data-store";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * This test file lives outside the app tsconfig project, so store reads resolve
 * as `error` types under type-aware lint. Read the shape structurally instead.
 */
const bookLevelField = (
  symbol: string,
  side: "bids" | "asks",
  index: number,
  field: "price" | "size" | "total",
): unknown => {
  const state: Record<string, unknown> = useMarketDataStore.getState();
  const books = state["orderbookData"];
  if (!isRecord(books)) return undefined;
  const book = books[symbol];
  if (!isRecord(book)) return undefined;
  const levels = book[side];
  if (!Array.isArray(levels)) return undefined;
  const level: unknown = levels[index];
  return isRecord(level) ? level[field] : undefined;
};

const level = (price: number, size: number): L2BookLevel => ({
  px: String(price),
  sz: String(size),
  n: 1,
});

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

describe("orderbook flush gate", () => {
  type FrameCallback = (time: number) => void;

  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let pendingFrame: FrameCallback | null = null;

  const flushFrame = (): void => {
    const callback = pendingFrame;
    pendingFrame = null;
    callback?.(0);
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
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  test("propagates a snapshot that only changes levels below the top of book", () => {
    const symbol = "GATE-DEEP";
    const bids = [level(100, 1), level(99, 2), level(98, 3)];
    const asks = [level(101, 1), level(102, 2)];

    useMarketDataStore.getState().applyOrderbookSnapshot(symbol, [bids, asks]);
    flushFrame();

    expect(bookLevelField(symbol, "bids", 2, "size")).toBe(3);

    const deeperBids = [level(100, 1), level(99, 2), level(98, 9)];
    useMarketDataStore.getState().applyOrderbookSnapshot(symbol, [deeperBids, asks]);
    flushFrame();

    expect(bookLevelField(symbol, "bids", 2, "size")).toBe(9);
    expect(bookLevelField(symbol, "bids", 2, "total")).toBe(12);
  });

  test("sorts a shuffled snapshot and recomputes totals in order", () => {
    const symbol = "ORDERING";

    useMarketDataStore.getState().applyOrderbookSnapshot(symbol, [
      [level(101, 5), level(99, 1), level(100, 2)],
      [level(103, 1), level(102, 2)],
    ]);
    flushFrame();

    expect(bookLevelField(symbol, "bids", 0, "price")).toBe(101);
    expect(bookLevelField(symbol, "bids", 1, "price")).toBe(100);
    expect(bookLevelField(symbol, "bids", 2, "price")).toBe(99);
    expect(bookLevelField(symbol, "bids", 0, "total")).toBe(5);
    expect(bookLevelField(symbol, "bids", 1, "total")).toBe(7);
    expect(bookLevelField(symbol, "asks", 0, "price")).toBe(102);
    expect(bookLevelField(symbol, "asks", 1, "price")).toBe(103);
  });
});
