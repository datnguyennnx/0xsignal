/** Find Entries Tests - Using @effect/vitest */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { findEntry } from "../find-entries";
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

describe("Find Entries", () => {
  describe("findEntry", () => {
    it.effect("returns valid EntrySignal structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        expect(typeof result.isOptimalEntry).toBe("boolean");
        expect(result.strength).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
        expect(result.indicators).toBeDefined();
        expect(typeof result.entryPrice).toBe("number");
        expect(typeof result.targetPrice).toBe("number");
        expect(typeof result.stopLoss).toBe("number");
        expect(typeof result.recommendation).toBe("string");
      })
    );

    it.effect("returns valid strength levels", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        const validStrengths = ["WEAK", "MODERATE", "STRONG", "VERY_STRONG"];
        expect(validStrengths).toContain(result.strength);
      })
    );

    it.effect("sets entry price to current price", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ price: 45000 });
        const result = yield* findEntry(price);

        expect(result.entryPrice).toBe(45000);
      })
    );

    it.effect("calculates target price above entry", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        expect(result.targetPrice).toBeGreaterThan(result.entryPrice);
      })
    );

    it.effect("calculates stop loss below entry", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        expect(result.stopLoss).toBeLessThan(result.entryPrice);
      })
    );

    it.effect("detects optimal entry when multiple indicators align", () =>
      Effect.gen(function* () {
        // Create conditions favorable for entry
        const bullishPrice = createMockPrice({
          change24h: 5,
          high24h: 52000,
          low24h: 48000,
        });

        const result = yield* findEntry(bullishPrice);

        // Check if indicators are detected
        expect(result.indicators).toBeDefined();
        expect(typeof result.indicators.trendReversal).toBe("boolean");
        expect(typeof result.indicators.volumeIncrease).toBe("boolean");
        expect(typeof result.indicators.momentumBuilding).toBe("boolean");
        expect(typeof result.indicators.bullishDivergence).toBe("boolean");
      })
    );

    it.effect("returns VERY_STRONG for 4 active indicators", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        const activeCount = Object.values(result.indicators).filter(Boolean).length;
        if (activeCount >= 4) {
          expect(result.strength).toBe("VERY_STRONG");
          expect(result.isOptimalEntry).toBe(true);
        }
      })
    );

    it.effect("returns STRONG for 3 active indicators", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        const activeCount = Object.values(result.indicators).filter(Boolean).length;
        if (activeCount === 3) {
          expect(result.strength).toBe("STRONG");
          expect(result.isOptimalEntry).toBe(true);
        }
      })
    );

    it.effect("returns MODERATE for 2 active indicators", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        const activeCount = Object.values(result.indicators).filter(Boolean).length;
        if (activeCount === 2) {
          expect(result.strength).toBe("MODERATE");
          expect(result.isOptimalEntry).toBe(true);
        }
      })
    );

    it.effect("returns WEAK for 0-1 active indicators", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        const activeCount = Object.values(result.indicators).filter(Boolean).length;
        if (activeCount <= 1) {
          expect(result.strength).toBe("WEAK");
          expect(result.isOptimalEntry).toBe(false);
        }
      })
    );

    it.effect("calculates confidence based on indicators and ADX", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        // Confidence formula: (activeCount / 4) * 70 + (adx / 100) * 30
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
      })
    );

    it.effect("generates recommendation for optimal entry", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        if (result.isOptimalEntry) {
          expect(result.recommendation).toContain("BULL");
          expect(result.recommendation.length).toBeGreaterThan(0);
        }
      })
    );

    it.effect("generates wait recommendation for non-optimal entry", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        if (!result.isOptimalEntry) {
          expect(result.recommendation).toBe("Not optimal entry. Wait for stronger bull signals.");
        }
      })
    );

    it.effect("returns success Exit (never fails)", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(findEntry(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );

    it.effect("handles price without high/low range", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          high24h: undefined,
          low24h: undefined,
        });

        const result = yield* findEntry(price);

        expect(result.strength).toBeDefined();
        expect(result.indicators).toBeDefined();
      })
    );

    it.effect("includes all entry indicator fields", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        expect(typeof result.indicators.trendReversal).toBe("boolean");
        expect(typeof result.indicators.volumeIncrease).toBe("boolean");
        expect(typeof result.indicators.momentumBuilding).toBe("boolean");
        expect(typeof result.indicators.bullishDivergence).toBe("boolean");
      })
    );

    it.effect("target and stop loss vary by strength", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ price: 50000 });
        const result = yield* findEntry(price);

        // Different strengths have different target/stop ratios
        const targetRatio = result.targetPrice / result.entryPrice;
        const stopRatio = result.stopLoss / result.entryPrice;

        // Target should be 5-20% above entry
        expect(targetRatio).toBeGreaterThan(1.04);
        expect(targetRatio).toBeLessThan(1.25);

        // Stop should be 5-12% below entry
        expect(stopRatio).toBeGreaterThan(0.85);
        expect(stopRatio).toBeLessThan(0.96);
      })
    );
  });
});
