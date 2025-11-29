/** Breakout Strategy Tests - Using @effect/vitest */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { breakoutStrategy } from "../breakout-strategy";
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

describe("Breakout Strategy", () => {
  describe("breakoutStrategy", () => {
    it.effect("returns valid StrategySignal structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* breakoutStrategy(price);

        expect(result.strategy).toBe("BREAKOUT");
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
        const result = yield* breakoutStrategy(price);

        const validSignals = ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"];
        expect(validSignals).toContain(result.signal);
      })
    );

    it.effect("includes squeeze intensity in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* breakoutStrategy(price);

        expect(result.metrics.squeezeIntensity).toBeDefined();
        expect(result.metrics.squeezeIntensity).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes ATR in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* breakoutStrategy(price);

        expect(result.metrics.atr).toBeDefined();
        expect(result.metrics.atr).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes normalized ATR in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* breakoutStrategy(price);

        expect(result.metrics.normalizedATR).toBeDefined();
        expect(result.metrics.normalizedATR).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes volume ROC in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* breakoutStrategy(price);

        expect(result.metrics.volumeROC).toBeDefined();
      })
    );

    it.effect("includes Donchian position in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* breakoutStrategy(price);

        expect(result.metrics.donchianPosition).toBeDefined();
        expect(result.metrics.donchianPosition).toBeGreaterThanOrEqual(0);
        expect(result.metrics.donchianPosition).toBeLessThanOrEqual(1);
      })
    );

    it.effect("includes ADX value in metrics", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* breakoutStrategy(price);

        expect(result.metrics.adxValue).toBeDefined();
        expect(result.metrics.adxValue).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("generates bullish signal for upper channel breakout", () =>
      Effect.gen(function* () {
        const breakoutPrice = createMockPrice({
          change24h: 8,
          price: 55000,
          high24h: 56000,
          low24h: 50000,
        });

        const result = yield* breakoutStrategy(breakoutPrice);

        // Should lean bullish or neutral for upper breakout
        expect(["STRONG_BUY", "BUY", "HOLD"]).toContain(result.signal);
      })
    );

    it.effect("generates bearish signal for lower channel breakout", () =>
      Effect.gen(function* () {
        const breakoutPrice = createMockPrice({
          change24h: -8,
          price: 45000,
          high24h: 50000,
          low24h: 44000,
        });

        const result = yield* breakoutStrategy(breakoutPrice);

        // Should lean bearish or neutral for lower breakout
        expect(["STRONG_SELL", "SELL", "HOLD"]).toContain(result.signal);
      })
    );

    it.effect("includes reasoning about squeeze pattern", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* breakoutStrategy(price);

        expect(result.reasoning.length).toBeGreaterThan(0);
        // Should mention squeeze or pattern
        expect(result.reasoning.toLowerCase()).toMatch(/squeeze|pattern|detected/);
      })
    );

    it.effect("returns success Exit (never fails)", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(breakoutStrategy(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );

    it.effect("handles price without high/low range", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          high24h: undefined,
          low24h: undefined,
        });

        const result = yield* breakoutStrategy(price);

        expect(result.strategy).toBe("BREAKOUT");
        expect(result.signal).toBeDefined();
      })
    );

    it.effect("handles low volatility consolidation", () =>
      Effect.gen(function* () {
        const consolidationPrice = createMockPrice({
          change24h: 0.5,
          high24h: 50200,
          low24h: 49800,
        });

        const result = yield* breakoutStrategy(consolidationPrice);

        expect(result.strategy).toBe("BREAKOUT");
        // Low volatility should have lower confidence
        expect(result.confidence).toBeLessThanOrEqual(80);
      })
    );
  });
});
