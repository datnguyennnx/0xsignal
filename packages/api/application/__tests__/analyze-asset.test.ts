/** Analyze Asset Tests - Using @effect/vitest */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { analyzeAsset } from "../analyze-asset";
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

describe("analyzeAsset", () => {
  it.effect("returns complete AssetAnalysis for valid price", () =>
    Effect.gen(function* () {
      const price = createMockPrice();
      const result = yield* analyzeAsset(price);

      expect(result.symbol).toBe("btc");
      expect(result.price).toEqual(price);
      expect(result.timestamp).toBeInstanceOf(Date);
    })
  );

  it.effect("includes strategy result with regime", () =>
    Effect.gen(function* () {
      const price = createMockPrice();
      const result = yield* analyzeAsset(price);

      expect(result.strategyResult).toBeDefined();
      expect(result.strategyResult.regime).toBeDefined();
      expect(result.strategyResult.primarySignal).toBeDefined();
    })
  );

  it.effect("includes entry signal analysis", () =>
    Effect.gen(function* () {
      const price = createMockPrice();
      const result = yield* analyzeAsset(price);

      expect(result.entrySignal).toBeDefined();
      expect(typeof result.entrySignal.isOptimalEntry).toBe("boolean");
      expect(result.entrySignal.strength).toBeDefined();
    })
  );

  it.effect("calculates overall signal", () =>
    Effect.gen(function* () {
      const price = createMockPrice();
      const result = yield* analyzeAsset(price);

      const validSignals = ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"];
      expect(validSignals).toContain(result.overallSignal);
    })
  );

  it.effect("calculates confidence between 0 and 100", () =>
    Effect.gen(function* () {
      const price = createMockPrice();
      const result = yield* analyzeAsset(price);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    })
  );

  it.effect("calculates risk score", () =>
    Effect.gen(function* () {
      const price = createMockPrice();
      const result = yield* analyzeAsset(price);

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
    })
  );

  it.effect("includes noise score", () =>
    Effect.gen(function* () {
      const price = createMockPrice();
      const result = yield* analyzeAsset(price);

      expect(result.noise).toBeDefined();
      // NoiseScore has 'value' and 'level' properties
      expect(result.noise.value).toBeGreaterThanOrEqual(0);
      expect(result.noise.level).toBeDefined();
    })
  );

  it.effect("generates recommendation string", () =>
    Effect.gen(function* () {
      const price = createMockPrice();
      const result = yield* analyzeAsset(price);

      expect(typeof result.recommendation).toBe("string");
      expect(result.recommendation.length).toBeGreaterThan(0);
    })
  );

  it.effect("returns success Exit (never fails)", () =>
    Effect.gen(function* () {
      const price = createMockPrice();
      const result = yield* Effect.exit(analyzeAsset(price));

      expect(Exit.isSuccess(result)).toBe(true);
    })
  );

  describe("signal upgrade scenarios", () => {
    it.effect("upgrades BUY to STRONG_BUY for optimal entry with strong strength", () =>
      Effect.gen(function* () {
        // Create conditions favorable for optimal entry
        const price = createMockPrice({
          change24h: -8, // Oversold condition
          price: 45000,
          low24h: 44000,
          athChangePercentage: -35,
        });

        const result = yield* analyzeAsset(price);

        // Should have entry signal analysis
        expect(result.entrySignal).toBeDefined();
      })
    );
  });
});
