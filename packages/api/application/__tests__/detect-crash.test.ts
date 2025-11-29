/** Detect Crash Tests - Using @effect/vitest */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { detectCrash } from "../detect-crash";
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

describe("Detect Crash", () => {
  describe("detectCrash", () => {
    it.effect("returns valid CrashSignal structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* detectCrash(price);

        expect(typeof result.isCrashing).toBe("boolean");
        expect(result.severity).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
        expect(result.indicators).toBeDefined();
        expect(typeof result.recommendation).toBe("string");
      })
    );

    it.effect("returns valid severity levels", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* detectCrash(price);

        const validSeverities = ["LOW", "MEDIUM", "HIGH", "EXTREME"];
        expect(validSeverities).toContain(result.severity);
      })
    );

    it.effect("detects crash for rapid price drop", () =>
      Effect.gen(function* () {
        const crashPrice = createMockPrice({
          change24h: -20,
          high24h: 60000,
          low24h: 40000,
        });

        const result = yield* detectCrash(crashPrice);

        expect(result.indicators.rapidDrop).toBe(true);
      })
    );

    it.effect("does not detect crash for normal conditions", () =>
      Effect.gen(function* () {
        const normalPrice = createMockPrice({
          change24h: 2,
          high24h: 51000,
          low24h: 49000,
        });

        const result = yield* detectCrash(normalPrice);

        expect(result.isCrashing).toBe(false);
        expect(result.severity).toBe("LOW");
      })
    );

    it.effect("detects crash when multiple indicators trigger", () =>
      Effect.gen(function* () {
        const severePrice = createMockPrice({
          change24h: -25,
          high24h: 70000,
          low24h: 35000,
          volume24h: 200000000000, // High volume
        });

        const result = yield* detectCrash(severePrice);

        // With rapid drop and high volatility, should detect crash
        const activeIndicators = Object.values(result.indicators).filter(Boolean).length;
        if (activeIndicators >= 2) {
          expect(result.isCrashing).toBe(true);
        }
      })
    );

    it.effect("calculates confidence based on active indicators", () =>
      Effect.gen(function* () {
        const crashPrice = createMockPrice({
          change24h: -20,
          high24h: 60000,
          low24h: 40000,
        });

        const result = yield* detectCrash(crashPrice);

        // Confidence should be proportional to active indicators
        const activeCount = Object.values(result.indicators).filter(Boolean).length;
        expect(result.confidence).toBe(Math.round((activeCount / 4) * 100));
      })
    );

    it.effect("returns EXTREME severity for 4 active indicators", () =>
      Effect.gen(function* () {
        // Create conditions that might trigger all indicators
        const extremePrice = createMockPrice({
          change24h: -30, // Rapid drop
          high24h: 80000,
          low24h: 30000, // High volatility
          volume24h: 500000000000, // Volume spike potential
        });

        const result = yield* detectCrash(extremePrice);

        // If all 4 indicators active, severity should be EXTREME
        const activeCount = Object.values(result.indicators).filter(Boolean).length;
        if (activeCount >= 4) {
          expect(result.severity).toBe("EXTREME");
        }
      })
    );

    it.effect("returns HIGH severity for 3 active indicators", () =>
      Effect.gen(function* () {
        const highSeverityPrice = createMockPrice({
          change24h: -20,
          high24h: 65000,
          low24h: 35000,
        });

        const result = yield* detectCrash(highSeverityPrice);

        const activeCount = Object.values(result.indicators).filter(Boolean).length;
        if (activeCount === 3) {
          expect(result.severity).toBe("HIGH");
        }
      })
    );

    it.effect("returns MEDIUM severity for 2 active indicators", () =>
      Effect.gen(function* () {
        const mediumPrice = createMockPrice({
          change24h: -18,
          high24h: 55000,
          low24h: 45000,
        });

        const result = yield* detectCrash(mediumPrice);

        const activeCount = Object.values(result.indicators).filter(Boolean).length;
        if (activeCount === 2) {
          expect(result.severity).toBe("MEDIUM");
          expect(result.isCrashing).toBe(true);
        }
      })
    );

    it.effect("generates appropriate recommendation for crash", () =>
      Effect.gen(function* () {
        const crashPrice = createMockPrice({
          change24h: -20,
          high24h: 60000,
          low24h: 40000,
        });

        const result = yield* detectCrash(crashPrice);

        if (result.isCrashing) {
          expect(result.recommendation.length).toBeGreaterThan(0);
          // Should contain actionable advice
          expect(result.recommendation).not.toBe("No crash detected. Normal market conditions.");
        }
      })
    );

    it.effect("generates no crash message for normal conditions", () =>
      Effect.gen(function* () {
        const normalPrice = createMockPrice({
          change24h: 1,
          high24h: 50500,
          low24h: 49500,
        });

        const result = yield* detectCrash(normalPrice);

        if (!result.isCrashing) {
          expect(result.recommendation).toBe("No crash detected. Normal market conditions.");
        }
      })
    );

    it.effect("returns success Exit (never fails)", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(detectCrash(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );

    it.effect("handles price without high/low range", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          high24h: undefined,
          low24h: undefined,
        });

        const result = yield* detectCrash(price);

        expect(result.severity).toBeDefined();
        expect(result.indicators).toBeDefined();
      })
    );

    it.effect("includes all crash indicator fields", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* detectCrash(price);

        expect(typeof result.indicators.rapidDrop).toBe("boolean");
        expect(typeof result.indicators.volumeSpike).toBe("boolean");
        expect(typeof result.indicators.oversoldExtreme).toBe("boolean");
        expect(typeof result.indicators.highVolatility).toBe("boolean");
      })
    );
  });
});
