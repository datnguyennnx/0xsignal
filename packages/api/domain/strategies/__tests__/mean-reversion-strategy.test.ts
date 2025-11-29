/** Mean Reversion Strategy Tests - Using @effect/vitest */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { meanReversionStrategy } from "../mean-reversion-strategy";
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

describe("Mean Reversion Strategy", () => {
  describe("meanReversionStrategy", () => {
    it.effect("returns valid StrategySignal structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* meanReversionStrategy(price);

        expect(result.strategy).toBe("MEAN_REVERSION");
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
        const result = yield* meanReversionStrategy(price);

        const validSignals = ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"];
        expect(validSignals).toContain(result.signal);
      })
    );

    it.effect("includes percentB in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* meanReversionStrategy(price);

        expect(result.metrics.percentB).toBeDefined();
      })
    );

    it.effect("includes distanceFromMA in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* meanReversionStrategy(price);

        expect(result.metrics.distanceFromMA).toBeDefined();
      })
    );

    it.effect("includes RSI in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* meanReversionStrategy(price);

        expect(result.metrics.rsi).toBeDefined();
        expect(result.metrics.rsi).toBeGreaterThanOrEqual(0);
        expect(result.metrics.rsi).toBeLessThanOrEqual(100);
      })
    );

    it.effect("includes stochastic in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* meanReversionStrategy(price);

        expect(result.metrics.stochastic).toBeDefined();
      })
    );

    it.effect("includes ADX value in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* meanReversionStrategy(price);

        expect(result.metrics.adxValue).toBeDefined();
        expect(result.metrics.adxValue).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes indicator agreement in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* meanReversionStrategy(price);

        expect(result.metrics.indicatorAgreement).toBeDefined();
        expect(result.metrics.indicatorAgreement).toBeGreaterThanOrEqual(0);
        expect(result.metrics.indicatorAgreement).toBeLessThanOrEqual(100);
      })
    );

    it.effect("includes MACD trend in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* meanReversionStrategy(price);

        expect(result.metrics.macdTrend).toBeDefined();
        expect([-1, 0, 1]).toContain(result.metrics.macdTrend);
      })
    );

    it.effect("generates buy signal for oversold conditions", () =>
      Effect.gen(function* () {
        const oversoldPrice = createMockPrice({
          change24h: -10,
          price: 45000,
          low24h: 44000,
        });

        const result = yield* meanReversionStrategy(oversoldPrice);

        // Should lean bullish for oversold
        expect(["STRONG_BUY", "BUY", "HOLD"]).toContain(result.signal);
      })
    );

    it.effect("generates sell signal for overbought conditions", () =>
      Effect.gen(function* () {
        const overboughtPrice = createMockPrice({
          change24h: 10,
          price: 55000,
          high24h: 56000,
        });

        const result = yield* meanReversionStrategy(overboughtPrice);

        // Should lean bearish for overbought
        expect(["STRONG_SELL", "SELL", "HOLD"]).toContain(result.signal);
      })
    );

    it.effect("includes reasoning with indicator info", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* meanReversionStrategy(price);

        expect(result.reasoning.length).toBeGreaterThan(0);
      })
    );

    it.effect("returns success Exit (never fails)", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(meanReversionStrategy(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );

    it.effect("handles price without high/low range", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          high24h: undefined,
          low24h: undefined,
        });

        const result = yield* meanReversionStrategy(price);

        expect(result.strategy).toBe("MEAN_REVERSION");
        expect(result.signal).toBeDefined();
      })
    );
  });
});
