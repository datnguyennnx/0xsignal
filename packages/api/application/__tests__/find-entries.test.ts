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

        expect(result.direction).toBeDefined();
        expect(typeof result.isOptimalEntry).toBe("boolean");
        expect(result.strength).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
        expect(result.indicators).toBeDefined();
        expect(typeof result.entryPrice).toBe("number");
        expect(typeof result.targetPrice).toBe("number");
        expect(typeof result.stopLoss).toBe("number");
        expect(typeof result.recommendation).toBe("string");
        expect(result.indicatorSummary).toBeDefined();
        expect(result.dataSource).toBe("24H_SNAPSHOT");
      })
    );

    it.effect("returns valid direction values", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        const validDirections = ["LONG", "SHORT", "NEUTRAL"];
        expect(validDirections).toContain(result.direction);
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

    // Stablecoin filtering tests
    it.effect("returns NEUTRAL for USDT (stablecoin)", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ symbol: "usdt", price: 1.0, change24h: 0.01 });
        const result = yield* findEntry(price);

        expect(result.direction).toBe("NEUTRAL");
        expect(result.confidence).toBe(0);
        expect(result.isOptimalEntry).toBe(false);
        expect(result.recommendation).toContain("stablecoin");
      })
    );

    it.effect("returns NEUTRAL for USDC (stablecoin)", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ symbol: "usdc", price: 1.0, change24h: 0.02 });
        const result = yield* findEntry(price);

        expect(result.direction).toBe("NEUTRAL");
        expect(result.confidence).toBe(0);
      })
    );

    it.effect("returns NEUTRAL for DAI (stablecoin)", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ symbol: "dai", price: 1.0, change24h: -0.01 });
        const result = yield* findEntry(price);

        expect(result.direction).toBe("NEUTRAL");
        expect(result.confidence).toBe(0);
      })
    );

    it.effect("returns NEUTRAL for low volatility assets", () =>
      Effect.gen(function* () {
        // Very low volatility (high24h ≈ low24h ≈ price)
        const price = createMockPrice({
          symbol: "xyz",
          price: 100,
          high24h: 100.1,
          low24h: 99.9,
          change24h: 0.1,
          volume24h: 1000000, // Enough volume
        });
        const result = yield* findEntry(price);

        // Should be NEUTRAL due to low ATR
        expect(result.direction).toBe("NEUTRAL");
      })
    );

    it.effect("returns NEUTRAL for low volume assets", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          symbol: "xyz",
          volume24h: 50000, // Below $100K threshold
        });
        const result = yield* findEntry(price);

        expect(result.direction).toBe("NEUTRAL");
        expect(result.recommendation).toContain("insufficient");
      })
    );

    // Direction tests with signal override
    it.effect("returns LONG direction for BUY signal", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price, "BUY");

        expect(result.direction).toBe("LONG");
      })
    );

    it.effect("returns LONG direction for STRONG_BUY signal", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price, "STRONG_BUY");

        expect(result.direction).toBe("LONG");
      })
    );

    it.effect("returns SHORT direction for SELL signal", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price, "SELL");

        expect(result.direction).toBe("SHORT");
      })
    );

    it.effect("returns SHORT direction for STRONG_SELL signal", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price, "STRONG_SELL");

        expect(result.direction).toBe("SHORT");
      })
    );

    // Dynamic target/stop tests
    it.effect("calculates target above entry for LONG", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price, "BUY");

        if (result.direction === "LONG") {
          expect(result.targetPrice).toBeGreaterThan(result.entryPrice);
          expect(result.stopLoss).toBeLessThan(result.entryPrice);
        }
      })
    );

    it.effect("calculates target below entry for SHORT", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price, "SELL");

        if (result.direction === "SHORT") {
          expect(result.targetPrice).toBeLessThan(result.entryPrice);
          expect(result.stopLoss).toBeGreaterThan(result.entryPrice);
        }
      })
    );

    it.effect("calculates positive risk/reward ratio", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price, "BUY");

        if (result.direction !== "NEUTRAL") {
          expect(result.riskRewardRatio).toBeGreaterThan(0);
        }
      })
    );

    // Leverage tests
    it.effect("returns valid leverage values", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        expect(result.suggestedLeverage).toBeGreaterThanOrEqual(1);
        expect(result.maxLeverage).toBeGreaterThanOrEqual(result.suggestedLeverage);
      })
    );

    // Indicator summary tests
    it.effect("includes indicator summary with RSI", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        expect(result.indicatorSummary.rsi).toBeDefined();
        expect(result.indicatorSummary.rsi.value).toBeGreaterThanOrEqual(0);
        expect(result.indicatorSummary.rsi.value).toBeLessThanOrEqual(100);
      })
    );

    it.effect("includes indicator summary with MACD", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        expect(result.indicatorSummary.macd).toBeDefined();
        expect(["BULLISH", "BEARISH", "NEUTRAL"]).toContain(result.indicatorSummary.macd.trend);
      })
    );

    it.effect("includes indicator summary with ADX", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        expect(result.indicatorSummary.adx).toBeDefined();
        expect(result.indicatorSummary.adx.value).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes indicator summary with ATR", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        expect(result.indicatorSummary.atr).toBeDefined();
        expect(result.indicatorSummary.atr.value).toBeGreaterThanOrEqual(0);
      })
    );

    // Entry indicators tests
    it.effect("includes all entry indicator fields", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        expect(typeof result.indicators.trendReversal).toBe("boolean");
        expect(typeof result.indicators.volumeIncrease).toBe("boolean");
        expect(typeof result.indicators.momentumBuilding).toBe("boolean");
        expect(typeof result.indicators.divergence).toBe("boolean");
      })
    );

    // Optimal entry tests
    it.effect("isOptimalEntry requires direction and minimum indicators", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* findEntry(price);

        if (result.isOptimalEntry) {
          expect(result.direction).not.toBe("NEUTRAL");
          const activeCount = Object.values(result.indicators).filter(Boolean).length;
          expect(activeCount).toBeGreaterThanOrEqual(2);
        }
      })
    );

    // Exit tests
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
  });
});
