/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { normalizeCandle } from "./normalizeCandle";

const EPOCH_MS = Date.UTC(2026, 0, 2, 3, 4, 5, 678);
const EPOCH_SECONDS = Math.floor(EPOCH_MS / 1000);
const ISO = new Date(EPOCH_MS).toISOString();

const CANDLE = {
  timestamp: new Date(EPOCH_MS),
  open: 100,
  high: 110,
  low: 90,
  close: 105,
  volume: 12.5,
};

const EXPECTED = {
  time: EPOCH_SECONDS,
  open: 100,
  high: 110,
  low: 90,
  close: 105,
  volume: 12.5,
};

describe("normalizeCandle", () => {
  test("normalizes Date input to epoch seconds", () => {
    expect(normalizeCandle(CANDLE)).toEqual(EXPECTED);
  });

  test("normalizes ISO string input to epoch seconds", () => {
    expect(normalizeCandle({ ...CANDLE, timestamp: ISO })).toEqual(EXPECTED);
  });

  test("treats numeric timestamps below 1e12 as seconds", () => {
    expect(normalizeCandle({ ...CANDLE, timestamp: EPOCH_SECONDS })).toEqual(EXPECTED);
  });

  test("treats numeric timestamps above 1e12 as milliseconds", () => {
    expect(normalizeCandle({ ...CANDLE, timestamp: EPOCH_MS })).toEqual(EXPECTED);
  });

  test("reads the time and t timestamp aliases", () => {
    const aliases = {
      open: CANDLE.open,
      high: CANDLE.high,
      low: CANDLE.low,
      close: CANDLE.close,
      volume: CANDLE.volume,
    };

    expect(normalizeCandle({ ...aliases, time: EPOCH_SECONDS })).toEqual(EXPECTED);
    expect(normalizeCandle({ ...aliases, t: ISO })).toEqual(EXPECTED);
  });

  test("reads shorthand OHLCV fields and numeric strings", () => {
    expect(normalizeCandle({ t: EPOCH_SECONDS, o: 100, h: 110, l: 90, c: 105, v: "12.5" })).toEqual(
      EXPECTED,
    );
  });

  test("drops candles with unparseable timestamps", () => {
    for (const timestamp of ["not-a-date", Number.NaN, new Date(Number.NaN)]) {
      expect(normalizeCandle({ ...CANDLE, timestamp })).toBeNull();
    }
  });

  test("drops candles with a missing timestamp", () => {
    const { open, high, low, close, volume } = CANDLE;

    expect(normalizeCandle({ open, high, low, close, volume })).toBeNull();
  });

  test("drops candles with non-finite OHLCV", () => {
    const invalid = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "nope", null];

    for (const value of invalid) {
      expect(normalizeCandle({ ...CANDLE, open: value })).toBeNull();
      expect(normalizeCandle({ ...CANDLE, high: value })).toBeNull();
      expect(normalizeCandle({ ...CANDLE, low: value })).toBeNull();
      expect(normalizeCandle({ ...CANDLE, close: value })).toBeNull();
      expect(normalizeCandle({ ...CANDLE, volume: value })).toBeNull();
    }
  });

  test("keeps a zero volume candle", () => {
    expect(normalizeCandle({ ...CANDLE, volume: 0 })).toEqual({ ...EXPECTED, volume: 0 });
  });
});
