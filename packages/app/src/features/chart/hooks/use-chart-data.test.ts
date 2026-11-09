/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { ChartDataPoint } from "@0xsignal/shared";

import { toUtcTimestamps } from "../lib/time";
import { toLastUtcPoint } from "./use-chart-data";

const TIMEFRAME_SEC = 60;
const FIRST_CANDLE_SEC = 1_000_020;
const BAR_COUNT = 10_000;

const series = (count: number): ChartDataPoint[] =>
  Array.from({ length: count }, (_, index) => ({
    time: FIRST_CANDLE_SEC + index * TIMEFRAME_SEC,
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100 + index,
    volume: 1,
  }));

describe("useChartData conversion shape", () => {
  test("the tick path converts exactly one bar of a 10k-bar input", () => {
    const data = series(BAR_COUNT);
    const last = data.at(-1);

    const converted = toLastUtcPoint(last);

    expect(converted).toBeDefined();
    expect(Number(converted?.time)).toBe(Number(last?.time));
    expect(converted?.close).toBe(last?.close);
  });

  test("a full-reload conversion still covers every bar", () => {
    const data = series(BAR_COUNT);

    expect(toUtcTimestamps(data)).toHaveLength(BAR_COUNT);
  });

  test("an invalid last timestamp yields no converted point", () => {
    const point = series(1)[0];

    expect(point).toBeDefined();
    expect(toLastUtcPoint({ ...point, time: Number.NaN })).toBeUndefined();
  });

  test("an empty tail yields no converted point", () => {
    expect(toLastUtcPoint()).toBeUndefined();
  });
});
