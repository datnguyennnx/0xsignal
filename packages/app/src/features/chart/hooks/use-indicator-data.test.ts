/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import type { ActiveIndicator, ChartDataPoint } from "@0xsignal/shared";
import { AVAILABLE_INDICATORS } from "@0xsignal/shared";

import type { IndicatorRenderEntry } from "../utils/indicator-data";
import {
  buildEntries,
  disposeDeferredJob,
  getDeferredJobCount,
  getIndicatorCacheSize,
  MAX_CACHE_SIZE,
  scheduleDeferredJob,
} from "./use-indicator-data";

const TIMEFRAME_SEC = 60;
const FIRST_CANDLE_SEC = 1_000_020;

const smaConfig = AVAILABLE_INDICATORS.find((config) => config.id === "sma");
if (smaConfig === undefined) throw new Error("sma indicator config is missing");

/** Last value of a line entry; undefined for band entries. */
const lastValue = (entry: IndicatorRenderEntry | undefined): number | undefined =>
  entry?.type === "line" ? entry.data.at(-1)?.value : undefined;

const indicator: ActiveIndicator = {
  instanceId: "sma-1",
  config: smaConfig,
  params: { period: 2 },
  visible: true,
};

const series = (closes: readonly number[]): ChartDataPoint[] =>
  closes.map((close, index) => ({
    time: FIRST_CANDLE_SEC + index * TIMEFRAME_SEC,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1,
  }));

describe("useIndicatorData cache", () => {
  test("identical contents with a different array identity reuse the cached entry", () => {
    const data = series([100, 101, 102, 103, 104]);
    const recreated = data.map((candle) => ({ ...candle }));

    const first = buildEntries([indicator], data);
    const second = buildEntries([indicator], recreated);

    expect(second.get(indicator.instanceId)).toBe(first.get(indicator.instanceId));
  });

  test("a changed last close recomputes instead of serving the forming bar stale", () => {
    const data = series([100, 101, 102, 103, 104]);
    const ticked = series([100, 101, 102, 103, 120]);

    const first = buildEntries([indicator], data);
    const second = buildEntries([indicator], ticked);

    const firstEntry = first.get(indicator.instanceId);
    const secondEntry = second.get(indicator.instanceId);
    expect(secondEntry).not.toBe(firstEntry);
    expect(secondEntry?.meta.cacheKey).not.toBe(firstEntry?.meta.cacheKey);
    expect(lastValue(secondEntry)).not.toBe(lastValue(firstEntry));
  });

  test("many distinct datasets keep the cache at MAX_CACHE_SIZE", () => {
    for (let index = 0; index < MAX_CACHE_SIZE + 10; index++) {
      buildEntries([indicator], series([100, 101, 102, index + 1]));
    }

    expect(getIndicatorCacheSize()).toBe(MAX_CACHE_SIZE);
  });
});

describe("deferred job disposal", () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let scheduledId = 0;
  let cancelled: number[] = [];

  const job = (): Parameters<typeof scheduleDeferredJob>[1] => ({
    inputsKey: "inputs",
    signature: "signature",
    activeIndicators: [indicator],
    data: series([100, 101, 102]),
  });

  beforeEach(() => {
    scheduledId = 0;
    cancelled = [];
    globalThis.requestAnimationFrame = (): number => {
      scheduledId += 1;
      return 42;
    };
    globalThis.cancelAnimationFrame = (id: number): void => {
      cancelled.push(id);
    };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  test("disposing the last deferred job clears it and cancels the frame", () => {
    const slot = {};

    scheduleDeferredJob(slot, job());
    expect(getDeferredJobCount()).toBe(1);
    expect(scheduledId).toBe(1);

    disposeDeferredJob(slot);

    expect(getDeferredJobCount()).toBe(0);
    expect(cancelled).toEqual([42]);

    // Disposing twice is safe and never cancels a second frame.
    disposeDeferredJob(slot);
    expect(getDeferredJobCount()).toBe(0);
    expect(cancelled).toEqual([42]);
  });

  test("disposing one of several jobs keeps the shared frame alive", () => {
    const first = {};
    const second = {};

    scheduleDeferredJob(first, job());
    scheduleDeferredJob(second, job());
    disposeDeferredJob(first);

    expect(getDeferredJobCount()).toBe(1);
    expect(cancelled).toEqual([]);

    disposeDeferredJob(second);
    expect(cancelled).toEqual([42]);
  });
});
