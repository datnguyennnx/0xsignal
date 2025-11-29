/** Signals Tests - Using @effect/vitest */

import { expect, describe, it } from "vitest";
import type { CryptoPrice } from "@0xsignal/shared";
import type { IndicatorSet } from "../indicators";
import {
  detectCrashIndicators,
  detectEntryIndicators,
  generateCrashRecommendation,
  generateEntryRecommendation,
  calculateEntryLevels,
} from "../signals";

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

// Mock indicator set factory
const createMockIndicators = (overrides: Partial<IndicatorSet> = {}): IndicatorSet => ({
  rsi: { rsi: 50, signal: "NEUTRAL", momentum: 0 },
  macd: { macd: 0, signal: 0, histogram: 0, trend: "NEUTRAL" },
  adx: { adx: 25, plusDI: 20, minusDI: 20, trendStrength: "MODERATE", trendDirection: "NEUTRAL" },
  atr: { value: 1000, normalizedATR: 2, volatilityLevel: "NORMAL" },
  volumeROC: { value: 10, signal: "NORMAL", activity: "NORMAL" },
  drawdown: { value: 5, peakIndex: 0, troughIndex: 1, duration: 1, severity: "MILD" },
  divergence: {
    symbol: "btc",
    hasDivergence: false,
    divergenceType: "NONE",
    strength: 0,
    rsi: 50,
    priceAction: "NEUTRAL",
  },
  ...overrides,
});

describe("Signals", () => {
  describe("detectCrashIndicators", () => {
    it("detects rapid drop when change24h < -15", () => {
      const price = createMockPrice({ change24h: -20 });
      const indicators = createMockIndicators();

      const result = detectCrashIndicators(price, indicators);

      expect(result.rapidDrop).toBe(true);
    });

    it("does not detect rapid drop for normal price change", () => {
      const price = createMockPrice({ change24h: -5 });
      const indicators = createMockIndicators();

      const result = detectCrashIndicators(price, indicators);

      expect(result.rapidDrop).toBe(false);
    });

    it("detects volume spike when volumeROC > 100", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        volumeROC: { value: 150, signal: "SURGE", activity: "UNUSUAL" },
      });

      const result = detectCrashIndicators(price, indicators);

      expect(result.volumeSpike).toBe(true);
    });

    it("detects oversold extreme when RSI < 20", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        rsi: { rsi: 15, signal: "OVERSOLD", momentum: -10 },
      });

      const result = detectCrashIndicators(price, indicators);

      expect(result.oversoldExtreme).toBe(true);
    });

    it("detects high volatility when normalizedATR > 10", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        atr: { value: 5000, normalizedATR: 12, volatilityLevel: "VERY_HIGH" },
      });

      const result = detectCrashIndicators(price, indicators);

      expect(result.highVolatility).toBe(true);
    });

    it("returns all false for normal market conditions", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators();

      const result = detectCrashIndicators(price, indicators);

      expect(result.rapidDrop).toBe(false);
      expect(result.volumeSpike).toBe(false);
      expect(result.oversoldExtreme).toBe(false);
      expect(result.highVolatility).toBe(false);
    });
  });

  describe("detectEntryIndicators", () => {
    it("detects trend reversal with bullish MACD and moderate RSI", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        macd: { macd: 100, signal: 50, histogram: 50, trend: "BULLISH" },
        rsi: { rsi: 55, signal: "NEUTRAL", momentum: 5 },
      });

      const result = detectEntryIndicators(price, indicators);

      expect(result.trendReversal).toBe(true);
    });

    it("does not detect trend reversal with extreme RSI", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        macd: { macd: 100, signal: 50, histogram: 50, trend: "BULLISH" },
        rsi: { rsi: 80, signal: "OVERBOUGHT", momentum: 10 },
      });

      const result = detectEntryIndicators(price, indicators);

      expect(result.trendReversal).toBe(false);
    });

    it("detects volume increase when volumeROC > 20", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        volumeROC: { value: 30, signal: "HIGH", activity: "ELEVATED" },
      });

      const result = detectEntryIndicators(price, indicators);

      expect(result.volumeIncrease).toBe(true);
    });

    it("detects momentum building with strong ADX and positive change", () => {
      const price = createMockPrice({ change24h: 5 });
      const indicators = createMockIndicators({
        adx: {
          adx: 35,
          plusDI: 30,
          minusDI: 15,
          trendStrength: "STRONG",
          trendDirection: "BULLISH",
        },
      });

      const result = detectEntryIndicators(price, indicators);

      expect(result.momentumBuilding).toBe(true);
    });

    it("detects bullish divergence", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        divergence: {
          symbol: "btc",
          hasDivergence: true,
          divergenceType: "BULLISH",
          strength: 0.8,
          rsi: 35,
          priceAction: "LOWER_LOW",
        },
      });

      const result = detectEntryIndicators(price, indicators);

      expect(result.bullishDivergence).toBe(true);
    });

    it("does not detect bullish divergence for bearish divergence", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        divergence: {
          symbol: "btc",
          hasDivergence: true,
          divergenceType: "BEARISH",
          strength: 0.8,
          rsi: 65,
          priceAction: "HIGHER_HIGH",
        },
      });

      const result = detectEntryIndicators(price, indicators);

      expect(result.bullishDivergence).toBe(false);
    });
  });

  describe("generateCrashRecommendation", () => {
    it("returns no crash message when not crashing", () => {
      const result = generateCrashRecommendation(false, "LOW", -5, 50);

      expect(result).toBe("No crash detected. Normal market conditions.");
    });

    it("returns EXTREME crash recommendation", () => {
      const result = generateCrashRecommendation(true, "EXTREME", -25, 15);

      expect(result).toContain("EXTREME CRASH");
      expect(result).toContain("25");
      expect(result).toContain("AVOID");
    });

    it("returns HIGH severity crash recommendation", () => {
      const result = generateCrashRecommendation(true, "HIGH", -18, 25);

      expect(result).toContain("HIGH SEVERITY");
      expect(result).toContain("RSI");
    });

    it("returns MEDIUM crash recommendation", () => {
      const result = generateCrashRecommendation(true, "MEDIUM", -12, 35);

      expect(result).toContain("MEDIUM CRASH");
      expect(result).toContain("stop-losses");
    });

    it("returns LOW severity recommendation", () => {
      const result = generateCrashRecommendation(true, "LOW", -8, 45);

      expect(result).toContain("LOW SEVERITY");
      expect(result).toContain("Monitor");
    });
  });

  describe("calculateEntryLevels", () => {
    it("calculates VERY_STRONG entry levels", () => {
      const result = calculateEntryLevels(50000, "VERY_STRONG");

      expect(result.target).toBe(60000); // 50000 * 1.2
      expect(result.stopLoss).toBe(47500); // 50000 * 0.95
    });

    it("calculates STRONG entry levels", () => {
      const result = calculateEntryLevels(50000, "STRONG");

      expect(result.target).toBeCloseTo(57500, 0); // 50000 * 1.15
      expect(result.stopLoss).toBeCloseTo(46500, 0); // 50000 * 0.93
    });

    it("calculates MODERATE entry levels", () => {
      const result = calculateEntryLevels(50000, "MODERATE");

      expect(result.target).toBeCloseTo(55000, 0); // 50000 * 1.1
      expect(result.stopLoss).toBeCloseTo(45000, 0); // 50000 * 0.9
    });

    it("calculates WEAK entry levels", () => {
      const result = calculateEntryLevels(50000, "WEAK");

      expect(result.target).toBe(52500); // 50000 * 1.05
      expect(result.stopLoss).toBe(44000); // 50000 * 0.88
    });
  });

  describe("generateEntryRecommendation", () => {
    it("returns not optimal message when not optimal entry", () => {
      const result = generateEntryRecommendation(false, "WEAK", 50000, 52500, 47500);

      expect(result).toBe("Not optimal entry. Wait for stronger bull signals.");
    });

    it("returns VERY_STRONG entry recommendation", () => {
      const result = generateEntryRecommendation(true, "VERY_STRONG", 50000, 60000, 47500);

      expect(result).toContain("VERY STRONG BULL ENTRY");
      expect(result).toContain("50000");
      expect(result).toContain("60000");
      expect(result).toContain("47500");
      expect(result).toContain("larger position");
    });

    it("returns STRONG entry recommendation", () => {
      const result = generateEntryRecommendation(true, "STRONG", 50000, 57500, 46500);

      expect(result).toContain("STRONG BULL ENTRY");
      expect(result).toContain("confirmation");
    });

    it("returns MODERATE entry recommendation", () => {
      const result = generateEntryRecommendation(true, "MODERATE", 50000, 55000, 45000);

      expect(result).toContain("MODERATE BULL ENTRY");
      expect(result).toContain("smaller position");
    });

    it("returns WEAK entry recommendation", () => {
      const result = generateEntryRecommendation(true, "WEAK", 50000, 52500, 44000);

      expect(result).toContain("WEAK BULL SIGNAL");
      expect(result).toContain("risky");
    });

    it("includes risk/reward ratio in recommendation", () => {
      const result = generateEntryRecommendation(true, "STRONG", 50000, 57500, 46500);

      expect(result).toContain("Risk/Reward");
    });
  });
});
