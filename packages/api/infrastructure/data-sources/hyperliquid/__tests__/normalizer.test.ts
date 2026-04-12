import { describe, it, expect } from "vitest";
import { normalizeCandle, normalizeCandles } from "../normalizer";

describe("Hyperliquid Normalizer", () => {
  it("should correctly normalize a single HL candle", () => {
    const hlCandle = {
      t: 1712928000000,
      o: "60000.5",
      h: "61000.0",
      l: "59000.0",
      c: "60500.2",
      v: "10.5",
    };

    const normalized = normalizeCandle(hlCandle);

    expect(normalized.timestamp.getTime()).toBe(1712928000000);
    expect(normalized.open).toBe(60000.5);
    expect(normalized.high).toBe(61000.0);
    expect(normalized.low).toBe(59000.0);
    expect(normalized.close).toBe(60500.2);
    expect(normalized.volume).toBe(10.5);
  });

  it("should handle mixed types if SDK returns numbers (unexpected but safe)", () => {
    const hlCandle = {
      t: 1712928000000,
      o: 60000.5,
      h: 61000.0,
      l: 59000.0,
      c: 60500.2,
      v: 10.5,
    };

    const normalized = normalizeCandle(hlCandle);
    expect(normalized.open).toBe(60000.5);
  });

  it("should correctly normalize an array of candles", () => {
    const hlCandles = [
      { t: 1000, o: "1", h: "2", l: "0.5", c: "1.5", v: "10" },
      { t: 2000, o: "1.5", h: "2.5", l: "1", c: "2", v: "20" },
    ];

    const normalized = normalizeCandles(hlCandles);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].timestamp.getTime()).toBe(1000);
    expect(normalized[1].timestamp.getTime()).toBe(2000);
  });
});
