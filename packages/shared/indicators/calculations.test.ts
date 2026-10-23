/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import type { ChartDataPoint } from "../types/chart";
import { calculateEMA, calculateSMA } from "./calculations";

const bar = (time: number, close: number): ChartDataPoint => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1,
});

const CLOSES = [10, 20, 30, 50];
const SERIES = CLOSES.map((close, index) => bar(100 + index, close));

describe("calculateSMA", () => {
  test("averages each completed window at its closing bar", () => {
    const result = calculateSMA(SERIES, 3);

    expect(result.map((point) => point.time)).toEqual([102, 103]);
    expect(result[0]?.value).toBeCloseTo(20, 10);
    expect(result[1]?.value).toBeCloseTo(100 / 3, 10);
  });

  test("returns nothing when the series is shorter than the period", () => {
    expect(calculateSMA(SERIES.slice(0, 2), 3)).toEqual([]);
  });
});

describe("calculateEMA", () => {
  test("seeds from the SMA and applies the smoothing multiplier", () => {
    const result = calculateEMA(SERIES, 3);

    expect(result.map((point) => point.time)).toEqual([102, 103]);
    expect(result[0]?.value).toBeCloseTo(20, 10);
    expect(result[1]?.value).toBeCloseTo(35, 10);
  });

  test("returns nothing when the series is shorter than the period", () => {
    expect(calculateEMA(SERIES.slice(0, 2), 3)).toEqual([]);
  });
});
