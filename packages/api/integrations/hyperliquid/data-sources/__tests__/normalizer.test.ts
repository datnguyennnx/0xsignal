import { describe, it, expect } from "vitest";
import type { DecimalString } from "@0xsignal/sdk-hyperliquid";
import { normalizeCandle, normalizeCandles } from "../normalizer";

const decimal = (value: string): DecimalString => value as DecimalString;

describe("Hyperliquid Normalizer", () => {
  it("should correctly normalize a single HL candle", () => {
    const hlCandle = {
      T: 1712928600000,
      t: 1712928000000,
      o: decimal("60000.5"),
      h: decimal("61000.0"),
      l: decimal("59000.0"),
      c: decimal("60500.2"),
      v: decimal("10.5"),
      n: 42,
      i: "1m" as const,
      s: "BTC",
    };

    const normalized = normalizeCandle(hlCandle);

    expect(normalized.t).toBe(1712928000000);
    expect(normalized.open).toBe("60000.5");
    expect(normalized.high).toBe("61000.0");
    expect(normalized.low).toBe("59000.0");
    expect(normalized.close).toBe("60500.2");
    expect(normalized.volume).toBe("10.5");
    expect(normalized.T).toBe(1712928600000);
    expect(normalized.n).toBe(42);
    expect(normalized.i).toBe("1m");
    expect(normalized.s).toBe("BTC");
  });

  it("should pass the SDK decimal strings through unchanged", () => {
    const hlCandle = {
      T: 1712928600000,
      t: 1712928000000,
      o: decimal("0.00005"),
      h: decimal("0.00006"),
      l: decimal("0.00004"),
      c: decimal("0.000055"),
      v: decimal("123456.789"),
      n: 7,
      i: "1h" as const,
      s: "PURR/USDC",
    };

    const normalized = normalizeCandle(hlCandle);
    expect(normalized.open).toBe("0.00005");
    expect(normalized.volume).toBe("123456.789");
  });

  it("should correctly normalize an array of candles", () => {
    const hlCandles = [
      {
        T: 1059,
        t: 1000,
        o: decimal("1"),
        h: decimal("2"),
        l: decimal("0.5"),
        c: decimal("1.5"),
        v: decimal("10"),
        n: 1,
        i: "1m" as const,
        s: "BTC",
      },
      {
        T: 2059,
        t: 2000,
        o: decimal("1.5"),
        h: decimal("2.5"),
        l: decimal("1"),
        c: decimal("2"),
        v: decimal("20"),
        n: 1,
        i: "1m" as const,
        s: "BTC",
      },
    ];

    const normalized = normalizeCandles(hlCandles);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].t).toBe(1000);
    expect(normalized[1].t).toBe(2000);
  });
});
