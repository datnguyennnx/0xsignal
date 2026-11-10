/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { BandIndicatorDataPoint, IndicatorDataPoint } from "@0xsignal/shared";

import type { UtcDated } from "../lib/time";
import type { BandConversionCacheEntry } from "./use-indicator-overlay";
import { syncSeriesData, updateBandConversion } from "./use-indicator-overlay";

const TIMEFRAME_SEC = 60;
const FIRST_POINT_SEC = 1_000_020;

const points = (values: readonly number[]): IndicatorDataPoint[] =>
  values.map((value, index) => ({ time: FIRST_POINT_SEC + index * TIMEFRAME_SEC, value }));

/** Move the tail timestamp forward; used to model a reshaped dataset. */
const moveLastTime = (data: readonly IndicatorDataPoint[]): IndicatorDataPoint[] => {
  const last = data.at(-1);
  if (last === undefined) return [...data];
  return [...data.slice(0, -1), { ...last, time: last.time + TIMEFRAME_SEC }];
};

type ConvertedPoint = UtcDated<IndicatorDataPoint>;

/** Minimal fake of the two series calls the overlay makes. */
const fakeSeries = () => {
  const updates: ConvertedPoint[] = [];
  const dataSets: ConvertedPoint[][] = [];
  const series = {
    update: (point: ConvertedPoint) => {
      updates.push(point);
    },
    setData: (next: ConvertedPoint[]) => {
      dataSets.push(next);
    },
  };
  return { series, updates, dataSets };
};

describe("syncSeriesData", () => {
  test("same length and only the tail changed -> one update, never setData", () => {
    const { series, updates, dataSets } = fakeSeries();

    syncSeriesData(series, points([1, 2, 3]), points([1, 2, 4]));

    expect(updates).toHaveLength(1);
    expect(updates[0]?.value).toBe(4);
    expect(dataSets).toHaveLength(0);
  });

  test("length change -> setData, never update", () => {
    const { series, updates, dataSets } = fakeSeries();

    syncSeriesData(series, points([1, 2, 3]), points([1, 2, 3, 4]));

    expect(updates).toHaveLength(0);
    expect(dataSets).toHaveLength(1);
    expect(dataSets[0]).toHaveLength(4);
  });

  test("unchanged dataset -> neither call", () => {
    const { series, updates, dataSets } = fakeSeries();

    syncSeriesData(series, points([1, 2, 3]), points([1, 2, 3]));

    expect(updates).toHaveLength(0);
    expect(dataSets).toHaveLength(0);
  });

  test("a non-tail change at the same length is a reshape -> setData", () => {
    const { series, updates, dataSets } = fakeSeries();

    syncSeriesData(series, points([1, 2, 3]), points([1, 9, 3]));

    expect(updates).toHaveLength(0);
    expect(dataSets).toHaveLength(1);
  });

  test("a moved last timestamp is a reshape -> setData", () => {
    const { series, updates, dataSets } = fakeSeries();
    const previous = points([1, 2, 3]);
    const moved = moveLastTime(points([1, 2, 4]));

    syncSeriesData(series, previous, moved);

    expect(updates).toHaveLength(0);
    expect(dataSets).toHaveLength(1);
  });

  test("first sync has no previous dataset -> setData", () => {
    const { series, updates, dataSets } = fakeSeries();

    syncSeriesData(series, undefined, points([1, 2, 3]));

    expect(updates).toHaveLength(0);
    expect(dataSets).toHaveLength(1);
  });
});

const bandPoints = (values: readonly number[]): BandIndicatorDataPoint[] =>
  values.map((value, index) => ({
    time: FIRST_POINT_SEC + index * TIMEFRAME_SEC,
    upper: value + 1,
    middle: value,
    lower: value - 1,
  }));

const bandCache = (
  cacheKey: string,
  source: readonly BandIndicatorDataPoint[],
): BandConversionCacheEntry => ({
  cacheKey,
  source,
  converted: updateBandConversion(undefined, cacheKey, source),
});

describe("updateBandConversion", () => {
  test("a tail-append reuses the cached converted array in place", () => {
    const all = bandPoints([1, 2, 3, 4]);
    const cached = bandCache("k", all.slice(0, 3));

    const converted = updateBandConversion(cached, "k", all);

    expect(converted).toBe(cached.converted);
    expect(converted).toHaveLength(4);
    expect(converted.at(-1)?.middle).toBe(4);
  });

  test("a tail-replace reuses the cached array and swaps the last point", () => {
    const cached = bandCache("k", bandPoints([1, 2, 3]));

    const converted = updateBandConversion(cached, "k", bandPoints([1, 2, 9]));

    expect(converted).toBe(cached.converted);
    expect(converted.at(-1)?.middle).toBe(9);
    expect(converted[1]?.middle).toBe(2);
  });

  test("a mid-series change forces a full rebuild", () => {
    const cached = bandCache("k", bandPoints([1, 2, 3]));

    const converted = updateBandConversion(cached, "k", bandPoints([1, 9, 3]));

    expect(converted).not.toBe(cached.converted);
    expect(converted[1]?.middle).toBe(9);
    expect(converted).toHaveLength(3);
  });

  test("a mid-series change that also appends forces a full rebuild", () => {
    const cached = bandCache("k", bandPoints([1, 2, 3]));

    const converted = updateBandConversion(cached, "k", bandPoints([1, 9, 3, 4]));

    expect(converted).not.toBe(cached.converted);
    expect(converted.map((point) => point.middle)).toEqual([1, 9, 3, 4]);
  });

  test("a changed cache key (identity/params) rebuilds", () => {
    const source = bandPoints([1, 2, 3]);
    const cached = bandCache("k", source);

    const converted = updateBandConversion(cached, "other", source);

    expect(converted).not.toBe(cached.converted);
    expect(converted).toHaveLength(3);
  });
});
