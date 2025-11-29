/** Momentum Strategy Tests - Using @effect/vitest */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { executeMomentumStrategy } from "../momentum";
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

describe("Momentum Strategy", () => {
  describe("executeMomentumStrategy", () => {
    it.effect("returns valid StrategySignal structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* executeMomentumStrategy(price);

        expect(result.strategy).toBe("MOMENTUM");
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
        const result = yield* executeMomentumStrategy(price);

        const validSignals = ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"];
        expect(validSignals).toContain(result.signal);
      })
    );

    it.effect("includes RSI in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* executeMomentumStrategy(price);

        expect(result.metrics.rsi).toBeDefined();
        expect(result.metrics.rsi).toBeGreaterThanOrEqual(0);
        expect(result.metrics.rsi).toBeLessThanOrEqual(100);
      })
    );

    it.effect("includes MACD trend in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* executeMomentumStrategy(price);

        expect(result.metrics.macdTrend).toBeDefined();
        expect([-1, 0, 1]).toContain(result.metrics.macdTrend);
      })
    );

    it.effect("includes ADX value in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* executeMomentumStrategy(price);

        expect(result.metrics.adxValue).toBeDefined();
        expect(result.metrics.adxValue).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes indicator agreement in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* executeMomentumStrategy(price);

        expect(result.metrics.indicatorAgreement).toBeDefined();
        expect(result.metrics.indicatorAgreement).toBeGreaterThanOrEqual(0);
        expect(result.metrics.indicatorAgreement).toBeLessThanOrEqual(100);
      })
    );

    it.effect("includes price change in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ change24h: 5.5 });
        const result = yield* executeMomentumStrategy(price);

        expect(result.metrics.priceChange24h).toBeDefined();
      })
    );

    it.effect("generates bullish signal for positive momentum", () =>
      Effect.gen(function* () {
        const bullishPrice = createMockPrice({
          change24h: 8,
          high24h: 54000,
          low24h: 48000,
        });

        const result = yield* executeMomentumStrategy(bullishPrice);

        // Should lean bullish or neutral
        expect(["STRONG_BUY", "BUY", "HOLD"]).toContain(result.signal);
      })
    );

    it.effect("generates bearish signal for negative momentum", () =>
      Effect.gen(function* () {
        const bearishPrice = createMockPrice({
          change24h: -8,
          high24h: 52000,
          low24h: 46000,
        });

        const result = yield* executeMomentumStrategy(bearishPrice);

        // Should lean bearish or neutral
        expect(["STRONG_SELL", "SELL", "HOLD"]).toContain(result.signal);
      })
    );

    it.effect("includes reasoning with consensus info", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* executeMomentumStrategy(price);

        expect(result.reasoning.length).toBeGreaterThan(0);
        // Should mention consensus/agreement
        expect(result.reasoning.toLowerCase()).toMatch(/consensus|agreement|signals/);
      })
    );

    it.effect("returns success Exit (never fails)", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(executeMomentumStrategy(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );

    it.effect("handles price without high/low range", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          high24h: undefined,
          low24h: undefined,
        });

        const result = yield* executeMomentumStrategy(price);

        expect(result.strategy).toBe("MOMENTUM");
        expect(result.signal).toBeDefined();
      })
    );
  });
});
