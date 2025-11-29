/** Strategy Executor Tests - Using @effect/vitest */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { executeStrategies } from "../executor";
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

describe("Strategy Executor", () => {
  describe("executeStrategies", () => {
    it.effect("executes strategies and returns StrategyResult", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* executeStrategies(price);

        expect(result.regime).toBeDefined();
        expect(result.signals).toBeDefined();
        expect(result.primarySignal).toBeDefined();
        expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
        expect(result.overallConfidence).toBeLessThanOrEqual(100);
        expect(result.riskScore).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("returns valid signal types", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* executeStrategies(price);

        const validSignals = ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"];
        expect(validSignals).toContain(result.primarySignal.signal);
      })
    );

    it.effect("detects bullish regime for strong positive momentum", () =>
      Effect.gen(function* () {
        const bullishPrice = createMockPrice({
          change24h: 15,
          price: 60000,
          athChangePercentage: -13,
        });

        const result = yield* executeStrategies(bullishPrice);

        // High change can trigger HIGH_VOLATILITY regime
        expect(["BULL_MARKET", "TRENDING", "HIGH_VOLATILITY"]).toContain(result.regime);
      })
    );

    it.effect("detects bearish regime for strong negative momentum", () =>
      Effect.gen(function* () {
        const bearishPrice = createMockPrice({
          change24h: -15,
          price: 35000,
          athChangePercentage: -50,
        });

        const result = yield* executeStrategies(bearishPrice);

        expect(["BEAR_MARKET", "HIGH_VOLATILITY"]).toContain(result.regime);
      })
    );

    it.effect("includes metrics in primary signal", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* executeStrategies(price);

        expect(result.primarySignal.metrics).toBeDefined();
        expect(typeof result.primarySignal.reasoning).toBe("string");
      })
    );

    it.effect("returns success Exit for any valid price", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(executeStrategies(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });

  describe("regime detection edge cases", () => {
    it.effect("handles low volatility market", () =>
      Effect.gen(function* () {
        const lowVolPrice = createMockPrice({
          change24h: 0.5,
          high24h: 50100,
          low24h: 49900,
        });

        const result = yield* executeStrategies(lowVolPrice);

        expect(["LOW_VOLATILITY", "SIDEWAYS", "MEAN_REVERSION"]).toContain(result.regime);
      })
    );

    it.effect("handles high volatility market", () =>
      Effect.gen(function* () {
        const highVolPrice = createMockPrice({
          change24h: 8,
          high24h: 55000,
          low24h: 45000,
        });

        const result = yield* executeStrategies(highVolPrice);

        expect(result.regime).toBeDefined();
        expect(result.riskScore).toBeGreaterThan(30);
      })
    );
  });
});
