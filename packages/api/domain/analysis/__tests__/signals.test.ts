/** Signals Tests - Using vitest */

import { expect, describe, it } from "vitest";
import type { CryptoPrice } from "@0xsignal/shared";
import type { IndicatorSet } from "../indicators";
import {
  detectCrashIndicators,
  detectEntryIndicators,
  detectLongIndicators,
  detectShortIndicators,
  generateCrashRecommendation,
  generateEntryRecommendation,
  calculateLeverage,
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

  describe("detectLongIndicators", () => {
    it("detects trend reversal with bullish MACD and moderate RSI", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        macd: { macd: 100, signal: 50, histogram: 50, trend: "BULLISH" },
        rsi: { rsi: 55, signal: "NEUTRAL", momentum: 5 },
      });

      const result = detectLongIndicators(price, indicators);

      expect(result.trendReversal).toBe(true);
    });

    it("does not detect trend reversal with extreme RSI", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        macd: { macd: 100, signal: 50, histogram: 50, trend: "BULLISH" },
        rsi: { rsi: 80, signal: "OVERBOUGHT", momentum: 10 },
      });

      const result = detectLongIndicators(price, indicators);

      expect(result.trendReversal).toBe(false);
    });

    it("detects volume increase when volumeROC > 20", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        volumeROC: { value: 30, signal: "HIGH", activity: "ELEVATED" },
      });

      const result = detectLongIndicators(price, indicators);

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

      const result = detectLongIndicators(price, indicators);

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

      const result = detectLongIndicators(price, indicators);

      expect(result.divergence).toBe(true);
    });
  });

  describe("detectShortIndicators", () => {
    it("detects trend reversal with bearish MACD and moderate RSI", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators({
        macd: { macd: -100, signal: -50, histogram: -50, trend: "BEARISH" },
        rsi: { rsi: 45, signal: "NEUTRAL", momentum: -5 },
      });

      const result = detectShortIndicators(price, indicators);

      expect(result.trendReversal).toBe(true);
    });

    it("detects momentum building with strong ADX and negative change", () => {
      const price = createMockPrice({ change24h: -5 });
      const indicators = createMockIndicators({
        adx: {
          adx: 35,
          plusDI: 15,
          minusDI: 30,
          trendStrength: "STRONG",
          trendDirection: "BEARISH",
        },
      });

      const result = detectShortIndicators(price, indicators);

      expect(result.momentumBuilding).toBe(true);
    });

    it("detects bearish divergence", () => {
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

      const result = detectShortIndicators(price, indicators);

      expect(result.divergence).toBe(true);
    });
  });

  describe("detectEntryIndicators", () => {
    it("returns LONG direction for BUY signal", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators();

      const result = detectEntryIndicators(price, indicators, "BUY");

      expect(result.direction).toBe("LONG");
    });

    it("returns LONG direction for STRONG_BUY signal", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators();

      const result = detectEntryIndicators(price, indicators, "STRONG_BUY");

      expect(result.direction).toBe("LONG");
    });

    it("returns SHORT direction for SELL signal", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators();

      const result = detectEntryIndicators(price, indicators, "SELL");

      expect(result.direction).toBe("SHORT");
    });

    it("returns SHORT direction for STRONG_SELL signal", () => {
      const price = createMockPrice();
      const indicators = createMockIndicators();

      const result = detectEntryIndicators(price, indicators, "STRONG_SELL");

      expect(result.direction).toBe("SHORT");
    });

    it("returns NEUTRAL for HOLD with no strong indicators", () => {
      const price = createMockPrice({ change24h: 0 });
      const indicators = createMockIndicators({
        adx: { adx: 15, plusDI: 20, minusDI: 20, trendStrength: "WEAK", trendDirection: "NEUTRAL" },
      });

      const result = detectEntryIndicators(price, indicators, "HOLD");

      expect(result.direction).toBe("NEUTRAL");
    });

    it("returns LONG for HOLD when long indicators dominate", () => {
      const price = createMockPrice({ change24h: 5 });
      const indicators = createMockIndicators({
        macd: { macd: 100, signal: 50, histogram: 50, trend: "BULLISH" },
        rsi: { rsi: 55, signal: "NEUTRAL", momentum: 5 },
        adx: {
          adx: 30,
          plusDI: 30,
          minusDI: 15,
          trendStrength: "STRONG",
          trendDirection: "BULLISH",
        },
        volumeROC: { value: 30, signal: "HIGH", activity: "ELEVATED" },
      });

      const result = detectEntryIndicators(price, indicators, "HOLD");

      expect(result.direction).toBe("LONG");
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

  describe("calculateLeverage", () => {
    it("returns high leverage for low volatility (ATR < 1)", () => {
      const result = calculateLeverage(0.5);

      expect(result.suggested).toBe(10);
      expect(result.max).toBe(20);
    });

    it("returns moderate leverage for normal volatility (ATR 1-2)", () => {
      const result = calculateLeverage(1.5);

      expect(result.suggested).toBe(5);
      expect(result.max).toBe(10);
    });

    it("returns lower leverage for higher volatility (ATR 2-4)", () => {
      const result = calculateLeverage(3);

      expect(result.suggested).toBe(3);
      expect(result.max).toBe(5);
    });

    it("returns conservative leverage for high volatility (ATR 4-6)", () => {
      const result = calculateLeverage(5);

      expect(result.suggested).toBe(2);
      expect(result.max).toBe(3);
    });

    it("returns minimal leverage for extreme volatility (ATR > 6)", () => {
      const result = calculateLeverage(8);

      expect(result.suggested).toBe(1);
      expect(result.max).toBe(2);
    });
  });

  describe("generateEntryRecommendation", () => {
    it("returns not optimal message when direction is NEUTRAL", () => {
      const result = generateEntryRecommendation(
        false,
        "WEAK",
        "NEUTRAL",
        50000,
        52500,
        47500,
        1.5,
        3
      );

      expect(result).toBe("No clear setup. Wait for stronger confirmation signals.");
    });

    it("returns LONG recommendation with setup info", () => {
      const result = generateEntryRecommendation(true, "STRONG", "LONG", 50000, 55000, 47500, 2, 5);

      expect(result).toContain("LONG setup");
      expect(result).toContain("R:R 2:1");
      expect(result).toContain("5x leverage");
    });

    it("returns SHORT recommendation with setup info", () => {
      const result = generateEntryRecommendation(
        true,
        "STRONG",
        "SHORT",
        50000,
        45000,
        52500,
        2,
        5
      );

      expect(result).toContain("SHORT setup");
      expect(result).toContain("R:R 2:1");
    });

    it("returns VERY_STRONG entry recommendation with strong confirmation", () => {
      const result = generateEntryRecommendation(
        true,
        "VERY_STRONG",
        "LONG",
        50000,
        60000,
        47500,
        4,
        10
      );

      expect(result).toContain("Strong confirmation");
      expect(result).toContain("10x leverage");
    });

    it("returns WEAK entry recommendation with waiting suggestion", () => {
      const result = generateEntryRecommendation(
        false,
        "WEAK",
        "LONG",
        50000,
        52500,
        47500,
        1.5,
        3
      );

      expect(result).toContain("Weak confirmation");
      expect(result).toContain("waiting");
    });
  });
});
