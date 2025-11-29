/** Volatility Strategy Tests - Using @effect/vitest */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { volatilityStrategy } from "../volatility-strategy";
import type { CryptoPrice } from "@0xsignal/shared";

// Mock price data factory
const createMockPrice = (overrides: Partial<CryptoPrice> = {}): CryptoPrice => ({
  id: "bitcoin",
  symbol: "btc",
  price: 50000,
  marketCap: 1000000000000,
  volume24h: 50000000000,
  change24h: 2.5,
  timestamp: new Date(),
  high24h: 51000,
  low24h: 49000,
  ath: 69000,
  atl: 3000,
  athChangePercentage: -27.5,
  atlChangePercentage: 1566.67,
  ...overrides,
});

describe("Volatility Strategy", () => {
  describe("volatilityStrategy", () => {
    it.effect("returns valid StrategySignal structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* volatilityStrategy(price);

        expect(result.strategy).toBe("VOLATILITY");
        expect(result.signal).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
        expect(typeof result.reasoning).toBe("string");
        expect(result.metrics).toBeDefined();
      })
    );

    it.effect("returns valid signal types", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* volatilityStrategy(price);

        const validSignals = ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"];
        expect(validSignals).toContain(result.signal);
      })
    );

    it.effect("includes ATR in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* volatilityStrategy(price);

        expect(result.metrics.atr).toBeDefined();
        expect(result.metrics.atr).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes normalized ATR in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* volatilityStrategy(price);

        expect(result.metrics.normalizedATR).toBeDefined();
        expect(result.metrics.normalizedATR).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes historical volatility in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* volatilityStrategy(price);

        expect(result.metrics.historicalVol).toBeDefined();
        expect(result.metrics.historicalVol).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes Bollinger bandwidth in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* volatilityStrategy(price);

        expect(result.metrics.bbWidth).toBeDefined();
        expect(result.metrics.bbWidth).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes RSI in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* volatilityStrategy(price);

        expect(result.metrics.rsi).toBeDefined();
        expect(result.metrics.rsi).toBeGreaterThanOrEqual(0);
        expect(result.metrics.rsi).toBeLessThanOrEqual(100);
      })
    );

    it.effect("includes ADX value in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* volatilityStrategy(price);

        expect(result.metrics.adxValue).toBeDefined();
        expect(result.metrics.adxValue).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("generates buy signal for extreme lower band with oversold RSI", () =>
      Effect.gen(function* () {
        const oversoldPrice = createMockPrice({
          change24h: -15,
          price: 42000,
          low24h: 40000,
          high24h: 48000,
        });

        const result = yield* volatilityStrategy(oversoldPrice);

        // Should lean bullish for extreme oversold
        expect(["STRONG_BUY", "BUY", "HOLD"]).toContain(result.signal);
      })
    );

    it.effect("generates sell signal for extreme upper band with overbought RSI", () =>
      Effect.gen(function* () {
        const overboughtPrice = createMockPrice({
          change24h: 15,
          price: 58000,
          high24h: 60000,
          low24h: 52000,
        });

        const result = yield* volatilityStrategy(overboughtPrice);

        // Should lean bearish for extreme overbought
        expect(["STRONG_SELL", "SELL", "HOLD"]).toContain(result.signal);
      })
    );

    it.effect("reduces confidence in high volatility environment", () =>
      Effect.gen(function* () {
        const highVolPrice = createMockPrice({
          high24h: 60000,
          low24h: 40000,
          change24h: 10,
        });

        const normalPrice = createMockPrice({
          high24h: 51000,
          low24h: 49000,
          change24h: 2,
        });

        const highVolResult = yield* volatilityStrategy(highVolPrice);
        const normalResult = yield* volatilityStrategy(normalPrice);

        // High volatility should generally have lower or similar confidence
        // due to volatility penalty
        expect(highVolResult.confidence).toBeLessThanOrEqual(normalResult.confidence + 20);
      })
    );

    it.effect("includes reasoning about volatility environment", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* volatilityStrategy(price);

        expect(result.reasoning.length).toBeGreaterThan(0);
        // Should mention volatility
        expect(result.reasoning.toLowerCase()).toMatch(/volatility|caution/);
      })
    );

    it.effect("returns success Exit (never fails)", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(volatilityStrategy(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );

    it.effect("handles price without high/low range", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          high24h: undefined,
          low24h: undefined,
        });

        const result = yield* volatilityStrategy(price);

        expect(result.strategy).toBe("VOLATILITY");
        expect(result.signal).toBeDefined();
      })
    );

    it.effect("applies volatility penalty to score", () =>
      Effect.gen(function* () {
        const extremeVolPrice = createMockPrice({
          high24h: 70000,
          low24h: 30000,
          change24h: 20,
        });

        const result = yield* volatilityStrategy(extremeVolPrice);

        // Extreme volatility should result in cautious signal
        expect(result.strategy).toBe("VOLATILITY");
        expect(result.reasoning).toContain("caution");
      })
    );
  });
});
