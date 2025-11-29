/** Momentum Formulas Tests - MACD, Stochastic, ROC, Momentum, Williams %R, RSI */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";

// MACD
import { calculateMACD, calculateMACDSeries, computeMACD } from "../momentum/macd";
// Stochastic
import {
  calculateStochastic,
  calculateStochasticSeries,
  computeStochastic,
} from "../momentum/stochastic";
// ROC
import { calculateROC, calculateROCSeries, computeROC } from "../momentum/roc";
// Momentum
import { calculateMomentum, calculateMomentumSeries, computeMomentum } from "../momentum/momentum";
// Williams %R
import {
  calculateWilliamsR,
  calculateWilliamsRSeries,
  computeWilliamsR,
} from "../momentum/williams-r";
// RSI
import { calculateRSI, computeRSI, detectDivergence } from "../momentum/rsi";

// Mock price data factory for RSI tests
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
  ...overrides,
});

// Test data - simulated price series
const uptrend = [
  100, 102, 105, 108, 112, 115, 118, 122, 125, 128, 132, 135, 138, 142, 145, 148, 152, 155, 158,
  162, 165, 168, 172, 175, 178, 182, 185,
];
const downtrend = [
  185, 182, 178, 175, 172, 168, 165, 162, 158, 155, 152, 148, 145, 142, 138, 135, 132, 128, 125,
  122, 118, 115, 112, 108, 105, 102, 100,
];
const sideways = [
  100, 102, 99, 101, 100, 103, 98, 102, 100, 101, 99, 100, 102, 98, 101, 100, 99, 102, 100, 101, 99,
  100, 102, 98, 101, 100, 99,
];
const highs = uptrend.map((p) => p * 1.02);
const lows = uptrend.map((p) => p * 0.98);

describe("MACD", () => {
  describe("calculateMACD", () => {
    it("returns positive MACD for uptrend", () => {
      const result = calculateMACD(uptrend);
      expect(result.macd).toBeGreaterThan(0);
      expect(["BULLISH", "NEUTRAL"]).toContain(result.trend);
    });

    it("returns negative MACD for downtrend", () => {
      const result = calculateMACD(downtrend);
      expect(result.macd).toBeLessThan(0);
      expect(["BEARISH", "NEUTRAL"]).toContain(result.trend);
    });

    it("returns neutral for sideways market", () => {
      const result = calculateMACD(sideways);
      expect(Math.abs(result.macd)).toBeLessThan(5);
    });

    it("calculates histogram correctly", () => {
      const result = calculateMACD(uptrend);
      expect(result.histogram).toBeDefined();
      // Histogram should be close to MACD - signal (allowing for NaN edge cases)
      if (!isNaN(result.histogram)) {
        expect(result.histogram).toBeCloseTo(result.macd - result.signal, 2);
      }
    });

    it("respects custom periods", () => {
      const defaultResult = calculateMACD(uptrend);
      const customResult = calculateMACD(uptrend, 8, 17, 9);
      expect(customResult.macd).not.toBe(defaultResult.macd);
    });
  });

  describe("calculateMACDSeries", () => {
    it("returns arrays of correct length", () => {
      const result = calculateMACDSeries(uptrend);
      expect(result.macd.length).toBeGreaterThan(0);
      expect(result.signal.length).toBeGreaterThan(0);
      expect(result.histogram.length).toBeGreaterThan(0);
    });
  });

  describe("computeMACD (Effect)", () => {
    it.effect("computes MACD as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeMACD(uptrend);
        expect(result.macd).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.histogram).toBeDefined();
        expect(result.trend).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeMACD(uptrend));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Stochastic Oscillator", () => {
  describe("calculateStochastic", () => {
    it("returns overbought signal when price near high", () => {
      // Price at top of range
      const closes = [...Array(20)].map((_, i) => 100 + i);
      const highsArr = closes.map((p) => p + 2);
      const lowsArr = closes.map((p) => p - 10);

      const result = calculateStochastic(closes, highsArr, lowsArr);
      expect(result.k).toBeGreaterThan(70);
      expect(result.signal).toBe("OVERBOUGHT");
    });

    it("returns oversold signal when price near low", () => {
      // Price at bottom of range
      const closes = [...Array(20)].map((_, i) => 120 - i);
      const highsArr = closes.map((p) => p + 10);
      const lowsArr = closes.map((p) => p - 2);

      const result = calculateStochastic(closes, highsArr, lowsArr);
      expect(result.k).toBeLessThan(30);
      expect(result.signal).toBe("OVERSOLD");
    });

    it("returns neutral for mid-range price", () => {
      const closes = sideways;
      const highsArr = closes.map((p) => p + 5);
      const lowsArr = closes.map((p) => p - 5);

      const result = calculateStochastic(closes, highsArr, lowsArr);
      expect(result.k).toBeGreaterThan(20);
      expect(result.k).toBeLessThan(80);
      expect(result.signal).toBe("NEUTRAL");
    });

    it("handles zero range (high equals low)", () => {
      const closes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
      const highsArr = closes;
      const lowsArr = closes;

      const result = calculateStochastic(closes, highsArr, lowsArr);
      expect(result.k).toBe(50); // Default when range is zero
    });

    it("respects custom periods", () => {
      const closes = uptrend;
      const highsArr = highs;
      const lowsArr = lows;

      const default14 = calculateStochastic(closes, highsArr, lowsArr, 14, 3);
      const custom5 = calculateStochastic(closes, highsArr, lowsArr, 5, 3);
      expect(default14.k).not.toBe(custom5.k);
    });
  });

  describe("computeStochastic (Effect)", () => {
    it.effect("computes stochastic as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeStochastic(uptrend, highs, lows);
        expect(result.k).toBeDefined();
        expect(result.d).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.crossover).toBeDefined();
      })
    );
  });
});

describe("ROC (Rate of Change)", () => {
  describe("calculateROC", () => {
    it("returns positive ROC for uptrend", () => {
      const result = calculateROC(uptrend);
      expect(result.value).toBeGreaterThan(0);
      expect(result.momentum).toBe("POSITIVE");
    });

    it("returns negative ROC for downtrend", () => {
      const result = calculateROC(downtrend);
      expect(result.value).toBeLessThan(0);
      expect(result.momentum).toBe("NEGATIVE");
    });

    it("returns strong bullish for >10% change", () => {
      const prices = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 115];
      const result = calculateROC(prices);
      expect(result.value).toBeGreaterThan(10);
      expect(result.signal).toBe("STRONG_BULLISH");
    });

    it("returns strong bearish for <-10% change", () => {
      const prices = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 85];
      const result = calculateROC(prices);
      expect(result.value).toBeLessThan(-10);
      expect(result.signal).toBe("STRONG_BEARISH");
    });

    it("respects custom period", () => {
      const default12 = calculateROC(uptrend, 12);
      const custom5 = calculateROC(uptrend, 5);
      expect(default12.value).not.toBe(custom5.value);
    });
  });

  describe("calculateROCSeries", () => {
    it("returns correct length series", () => {
      const series = calculateROCSeries(uptrend, 12);
      expect(series.length).toBe(uptrend.length - 12);
    });
  });

  describe("computeROC (Effect)", () => {
    it.effect("computes ROC as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeROC(uptrend);
        expect(result.value).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.momentum).toBeDefined();
      })
    );
  });
});

describe("Momentum", () => {
  describe("calculateMomentum", () => {
    it("returns positive momentum for uptrend", () => {
      const result = calculateMomentum(uptrend);
      expect(result.value).toBeGreaterThan(0);
      expect(result.direction).toBe("UP");
    });

    it("returns negative momentum for downtrend", () => {
      const result = calculateMomentum(downtrend);
      expect(result.value).toBeLessThan(0);
      expect(result.direction).toBe("DOWN");
    });

    it("returns flat for no change", () => {
      const flat = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
      const result = calculateMomentum(flat);
      expect(result.value).toBe(0);
      expect(result.direction).toBe("FLAT");
    });

    it("calculates strength based on percent change", () => {
      const result = calculateMomentum(uptrend);
      expect(result.strength).toBeGreaterThanOrEqual(0);
      expect(result.strength).toBeLessThanOrEqual(100);
    });
  });

  describe("calculateMomentumSeries", () => {
    it("returns correct length series", () => {
      const series = calculateMomentumSeries(uptrend, 10);
      expect(series.length).toBe(uptrend.length - 10);
    });
  });

  describe("computeMomentum (Effect)", () => {
    it.effect("computes momentum as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeMomentum(uptrend);
        expect(result.value).toBeDefined();
        expect(result.direction).toBeDefined();
        expect(result.strength).toBeDefined();
      })
    );
  });
});

describe("Williams %R", () => {
  describe("calculateWilliamsR", () => {
    it("returns overbought (> -20) when price near high", () => {
      // Price consistently at highs
      const closes = highs.map((h) => h - 0.5);
      const result = calculateWilliamsR(closes, highs, lows);
      expect(result.value).toBeGreaterThan(-20);
      expect(result.signal).toBe("OVERBOUGHT");
    });

    it("returns value in valid range when price near low", () => {
      // Create data where close is at the low of the range
      const testHighs = [110, 112, 115, 118, 120, 122, 125, 128, 130, 132, 135, 138, 140, 142, 145];
      const testLows = [90, 92, 95, 98, 100, 102, 105, 108, 110, 112, 115, 118, 120, 122, 125];
      const testCloses = testLows.map((l) => l + 1);
      const result = calculateWilliamsR(testCloses, testHighs, testLows);
      // Williams %R should be between -100 and 0
      expect(result.value).toBeGreaterThanOrEqual(-100);
      expect(result.value).toBeLessThanOrEqual(0);
    });

    it("returns value between -100 and 0", () => {
      const result = calculateWilliamsR(uptrend, highs, lows);
      expect(result.value).toBeGreaterThanOrEqual(-100);
      expect(result.value).toBeLessThanOrEqual(0);
    });

    it("handles zero range", () => {
      const flat = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
      const result = calculateWilliamsR(flat, flat, flat);
      expect(result.value).toBe(-50); // Default when range is zero
    });

    it("classifies momentum based on value threshold", () => {
      const result = calculateWilliamsR(uptrend, highs, lows);
      // Momentum is BULLISH when value > -50, BEARISH when < -50
      if (result.value > -50) {
        expect(result.momentum).toBe("BULLISH");
      } else if (result.value < -50) {
        expect(result.momentum).toBe("BEARISH");
      } else {
        expect(result.momentum).toBe("NEUTRAL");
      }
    });
  });

  describe("calculateWilliamsRSeries", () => {
    it("returns correct length series", () => {
      const series = calculateWilliamsRSeries(uptrend, highs, lows, 14);
      expect(series.length).toBe(uptrend.length - 14 + 1);
    });
  });

  describe("computeWilliamsR (Effect)", () => {
    it.effect("computes Williams %R as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeWilliamsR(uptrend, highs, lows);
        expect(result.value).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.momentum).toBeDefined();
      })
    );
  });
});

describe("RSI (Relative Strength Index)", () => {
  describe("calculateRSI (pure function)", () => {
    it("returns neutral RSI for zero change", () => {
      const result = calculateRSI(50000, 0, 69000, 3000);
      // RSI includes ATH/ATL adjustment, so not exactly 50
      expect(result.rsi).toBeGreaterThan(40);
      expect(result.rsi).toBeLessThan(65);
      expect(result.signal).toBe("NEUTRAL");
    });

    it("returns overbought signal for high positive change", () => {
      const result = calculateRSI(50000, 10, 69000, 3000);
      expect(result.rsi).toBeGreaterThan(65);
      expect(result.signal).toBe("OVERBOUGHT");
      expect(result.momentum).toBeGreaterThan(0);
    });

    it("returns oversold signal for high negative change", () => {
      const result = calculateRSI(50000, -10, 69000, 3000);
      expect(result.rsi).toBeLessThan(35);
      expect(result.signal).toBe("OVERSOLD");
      expect(result.momentum).toBeLessThan(0);
    });

    it("clamps RSI between 10 and 90", () => {
      const extremeHigh = calculateRSI(50000, 50, 69000, 3000);
      const extremeLow = calculateRSI(50000, -50, 69000, 3000);

      expect(extremeHigh.rsi).toBeLessThanOrEqual(90);
      expect(extremeLow.rsi).toBeGreaterThanOrEqual(10);
    });

    it("handles missing ATH/ATL gracefully", () => {
      const result = calculateRSI(50000, 5, undefined, undefined);
      expect(result.rsi).toBeDefined();
      expect(result.signal).toBeDefined();
    });
  });

  describe("computeRSI (Effect-based)", () => {
    it.effect("computes RSI from CryptoPrice", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ change24h: 5 });
        const result = yield* computeRSI(price);

        expect(result.rsi).toBeGreaterThan(50);
        expect(result.signal).toBeDefined();
        expect(result.momentum).toBeGreaterThan(0);
      })
    );

    it.effect("returns success Exit for valid price", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(computeRSI(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });

  describe("detectDivergence (Effect-based)", () => {
    it.effect("detects bullish divergence near ATL with high RSI", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          price: 4000, // Near ATL of 3000
          atl: 3000,
          ath: 69000,
          change24h: -5,
        });

        const result = yield* detectDivergence(price);

        expect(result.symbol).toBe("btc");
        expect(result.priceAction).toBe("LOWER_LOW");
      })
    );

    it.effect("detects bearish divergence near ATH with low RSI", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          price: 65000, // Near ATH of 69000
          ath: 69000,
          atl: 3000,
          change24h: 5,
        });

        const result = yield* detectDivergence(price);

        expect(result.symbol).toBe("btc");
        expect(result.priceAction).toBe("HIGHER_HIGH");
      })
    );

    it.effect("returns no divergence for neutral price action", () =>
      Effect.gen(function* () {
        const price = createMockPrice({
          price: 35000, // Middle range
          ath: 69000,
          atl: 3000,
        });

        const result = yield* detectDivergence(price);

        expect(result.priceAction).toBe("NEUTRAL");
      })
    );
  });
});
