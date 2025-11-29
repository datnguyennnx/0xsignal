/** Indicators Tests - Using @effect/vitest */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { computeIndicators, computeQuickIndicators } from "../indicators";
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

describe("Indicators", () => {
  describe("computeIndicators", () => {
    it.effect("computes all indicators concurrently", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeIndicators(price);

        expect(result.rsi).toBeDefined();
        expect(result.macd).toBeDefined();
        expect(result.adx).toBeDefined();
        expect(result.atr).toBeDefined();
        expect(result.volumeROC).toBeDefined();
        expect(result.drawdown).toBeDefined();
        expect(result.divergence).toBeDefined();
      })
    );

    it.effect("returns valid RSI values (0-100)", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeIndicators(price);

        expect(result.rsi.rsi).toBeGreaterThanOrEqual(0);
        expect(result.rsi.rsi).toBeLessThanOrEqual(100);
        expect(["OVERSOLD", "NEUTRAL", "OVERBOUGHT"]).toContain(result.rsi.signal);
      })
    );

    it.effect("returns valid MACD structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeIndicators(price);

        expect(typeof result.macd.macd).toBe("number");
        expect(typeof result.macd.signal).toBe("number");
        expect(typeof result.macd.histogram).toBe("number");
        expect(["BULLISH", "BEARISH", "NEUTRAL"]).toContain(result.macd.trend);
      })
    );

    it.effect("returns valid ADX structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeIndicators(price);

        expect(result.adx.adx).toBeGreaterThanOrEqual(0);
        expect(typeof result.adx.plusDI).toBe("number");
        expect(typeof result.adx.minusDI).toBe("number");
        expect(result.adx.trendStrength).toBeDefined();
        expect(result.adx.trendDirection).toBeDefined();
      })
    );

    it.effect("returns valid ATR structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeIndicators(price);

        expect(result.atr.value).toBeGreaterThanOrEqual(0);
        expect(result.atr.normalizedATR).toBeGreaterThanOrEqual(0);
        expect(result.atr.volatilityLevel).toBeDefined();
      })
    );

    it.effect("returns valid Volume ROC structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeIndicators(price);

        expect(typeof result.volumeROC.value).toBe("number");
        expect(result.volumeROC.signal).toBeDefined();
        expect(result.volumeROC.activity).toBeDefined();
      })
    );

    it.effect("returns valid drawdown structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeIndicators(price);

        expect(result.drawdown.value).toBeGreaterThanOrEqual(0);
        expect(result.drawdown.severity).toBeDefined();
      })
    );

    it.effect("returns valid divergence structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeIndicators(price);

        expect(typeof result.divergence.hasDivergence).toBe("boolean");
        expect(["BULLISH", "BEARISH", "NONE"]).toContain(result.divergence.divergenceType);
      })
    );

    it.effect("handles price without high/low range", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          high24h: undefined,
          low24h: undefined,
        });
        const result = yield* computeIndicators(price);

        expect(result.rsi).toBeDefined();
        expect(result.macd).toBeDefined();
      })
    );

    it.effect("handles price without volume", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          volume24h: 0,
        });
        const result = yield* computeIndicators(price);

        expect(result.volumeROC).toBeDefined();
      })
    );

    it.effect("returns success Exit (never fails)", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(computeIndicators(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });

  describe("computeQuickIndicators", () => {
    it.effect("computes quick indicators subset", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeQuickIndicators(price);

        expect(result.rsi).toBeDefined();
        expect(result.atr).toBeDefined();
        expect(result.adx).toBeDefined();
      })
    );

    it.effect("returns valid RSI in quick indicators", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeQuickIndicators(price);

        expect(result.rsi.rsi).toBeGreaterThanOrEqual(0);
        expect(result.rsi.rsi).toBeLessThanOrEqual(100);
      })
    );

    it.effect("returns success Exit for quick indicators", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(computeQuickIndicators(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});
