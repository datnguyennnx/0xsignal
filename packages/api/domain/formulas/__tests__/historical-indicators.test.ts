import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { computeRSIFromHistory } from "../momentum/rsi";
import { computeMACDFromHistory } from "../momentum/macd";
import { computeADXFromHistory } from "../trend/adx";
import { computeATRFromHistory } from "../volatility/atr";

describe("Historical RSI", () => {
  const uptrend = [100, 102, 105, 108, 110, 112, 115, 118, 120, 122, 125, 128, 130, 132, 135, 138];
  const downtrend = [
    138, 135, 132, 130, 128, 125, 122, 120, 118, 115, 112, 110, 108, 105, 102, 100,
  ];
  const sideways = [100, 101, 99, 100, 101, 99, 100, 101, 99, 100, 101, 99, 100, 101, 99, 100];

  it("should return high RSI for uptrend", async () => {
    const result = await Effect.runPromise(computeRSIFromHistory(uptrend));
    expect(result.rsi).toBeGreaterThan(70);
    expect(result.signal).toBe("OVERBOUGHT");
    expect(result.momentum).toBeGreaterThan(0);
  });

  it("should return low RSI for downtrend", async () => {
    const result = await Effect.runPromise(computeRSIFromHistory(downtrend));
    expect(result.rsi).toBeLessThan(30);
    expect(result.signal).toBe("OVERSOLD");
    expect(result.momentum).toBeLessThan(0);
  });

  it("should return neutral RSI for sideways", async () => {
    const result = await Effect.runPromise(computeRSIFromHistory(sideways));
    expect(result.rsi).toBeGreaterThan(30);
    expect(result.rsi).toBeLessThan(70);
    expect(result.signal).toBe("NEUTRAL");
  });

  it("should return neutral for insufficient data", async () => {
    const result = await Effect.runPromise(computeRSIFromHistory([100, 101, 102]));
    expect(result.rsi).toBe(50);
    expect(result.signal).toBe("NEUTRAL");
  });
});

describe("Historical MACD", () => {
  const longUptrend = Array.from({ length: 40 }, (_, i) => 100 + i * 2);
  const longDowntrend = Array.from({ length: 40 }, (_, i) => 180 - i * 2);

  it("should show positive MACD for uptrend", async () => {
    const result = await Effect.runPromise(computeMACDFromHistory(longUptrend));
    expect(result.macd).toBeGreaterThan(0);
  });

  it("should show negative MACD for downtrend", async () => {
    const result = await Effect.runPromise(computeMACDFromHistory(longDowntrend));
    expect(result.macd).toBeLessThan(0);
  });

  it("should return neutral for insufficient data", async () => {
    const result = await Effect.runPromise(computeMACDFromHistory([100, 101, 102]));
    expect(result.trend).toBe("NEUTRAL");
  });
});

describe("Historical ADX", () => {
  const strongUptrend = {
    highs: Array.from({ length: 30 }, (_, i) => 110 + i * 3),
    lows: Array.from({ length: 30 }, (_, i) => 100 + i * 3),
    closes: Array.from({ length: 30 }, (_, i) => 105 + i * 3),
  };

  it("should detect strong trend", async () => {
    const result = await Effect.runPromise(
      computeADXFromHistory(strongUptrend.highs, strongUptrend.lows, strongUptrend.closes)
    );
    expect(result.adx).toBeGreaterThan(0);
    expect(result.direction).toBe("BULLISH");
  });

  it("should return weak for insufficient data", async () => {
    const result = await Effect.runPromise(
      computeADXFromHistory([100, 101], [99, 100], [100, 100])
    );
    expect(result.trend).toBe("WEAK");
  });
});

describe("Historical ATR", () => {
  const volatileData = {
    highs: [110, 115, 112, 118, 114, 120, 116, 122, 118, 124, 120, 126, 122, 128, 124, 130],
    lows: [100, 105, 102, 108, 104, 110, 106, 112, 108, 114, 110, 116, 112, 118, 114, 120],
    closes: [105, 110, 107, 113, 109, 115, 111, 117, 113, 119, 115, 121, 117, 123, 119, 125],
  };

  it("should calculate ATR for volatile data", async () => {
    const result = await Effect.runPromise(
      computeATRFromHistory(volatileData.highs, volatileData.lows, volatileData.closes)
    );
    expect(result.atr).toBeGreaterThan(0);
    expect(result.normalizedATR).toBeGreaterThan(0);
  });

  it("should return zero for insufficient data", async () => {
    const result = await Effect.runPromise(computeATRFromHistory([100], [99], [100]));
    expect(result.atr).toBe(0);
  });
});
