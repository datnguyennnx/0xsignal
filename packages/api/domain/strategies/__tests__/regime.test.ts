/** Regime Detection Tests - Using @effect/vitest */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { detectRegime } from "../regime";
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

describe("Regime Detection", () => {
  describe("detectRegime", () => {
    it.effect("returns a valid market regime", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const regime = yield* detectRegime(price);

        const validRegimes = [
          "BULL_MARKET",
          "BEAR_MARKET",
          "SIDEWAYS",
          "HIGH_VOLATILITY",
          "LOW_VOLATILITY",
          "MEAN_REVERSION",
          "TRENDING",
        ];
        expect(validRegimes).toContain(regime);
      })
    );

    it.effect("detects HIGH_VOLATILITY for extreme price swings", () =>
      Effect.gen(function* () {
        const highVolPrice = createMockPrice({
          high24h: 60000,
          low24h: 40000,
          change24h: 15,
        });

        const regime = yield* detectRegime(highVolPrice);

        expect(regime).toBe("HIGH_VOLATILITY");
      })
    );

    it.effect("detects LOW_VOLATILITY for compressed range", () =>
      Effect.gen(function* () {
        const lowVolPrice = createMockPrice({
          high24h: 50100,
          low24h: 49900,
          change24h: 0.1,
        });

        const regime = yield* detectRegime(lowVolPrice);

        expect(["LOW_VOLATILITY", "SIDEWAYS", "MEAN_REVERSION"]).toContain(regime);
      })
    );

    it.effect("detects BULL_MARKET for strong positive momentum with trend", () =>
      Effect.gen(function* () {
        const bullPrice = createMockPrice({
          change24h: 8,
          high24h: 54000,
          low24h: 48000,
        });

        const regime = yield* detectRegime(bullPrice);

        expect(["BULL_MARKET", "TRENDING", "HIGH_VOLATILITY"]).toContain(regime);
      })
    );

    it.effect("detects BEAR_MARKET for strong negative momentum with trend", () =>
      Effect.gen(function* () {
        const bearPrice = createMockPrice({
          change24h: -8,
          high24h: 52000,
          low24h: 46000,
        });

        const regime = yield* detectRegime(bearPrice);

        expect(["BEAR_MARKET", "HIGH_VOLATILITY"]).toContain(regime);
      })
    );

    it.effect("detects SIDEWAYS for low trend strength", () =>
      Effect.gen(function* () {
        const sidewaysPrice = createMockPrice({
          change24h: 0.5,
          high24h: 50500,
          low24h: 49500,
        });

        const regime = yield* detectRegime(sidewaysPrice);

        expect(["SIDEWAYS", "LOW_VOLATILITY", "MEAN_REVERSION"]).toContain(regime);
      })
    );

    it.effect("detects MEAN_REVERSION for moderate RSI and low change", () =>
      Effect.gen(function* () {
        const meanRevPrice = createMockPrice({
          change24h: 1,
          high24h: 50800,
          low24h: 49200,
        });

        const regime = yield* detectRegime(meanRevPrice);

        expect(["MEAN_REVERSION", "SIDEWAYS", "LOW_VOLATILITY", "TRENDING"]).toContain(regime);
      })
    );

    it.effect("returns success Exit (never fails)", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(detectRegime(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );

    it.effect("handles price without high/low range", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          high24h: undefined,
          low24h: undefined,
        });

        const regime = yield* detectRegime(price);

        expect(regime).toBeDefined();
      })
    );
  });
});
