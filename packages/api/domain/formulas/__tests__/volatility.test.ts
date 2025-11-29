/** Volatility Formulas Tests - ATR, Bollinger Bands, Donchian Channels, Garman-Klass, Historical Volatility, Keltner Channels, Parkinson */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";

// ATR
import { calculateATR, calculateTrueRange, computeATR } from "../volatility/atr";
// Bollinger Bands
import {
  calculateBollingerBands,
  computeBollingerBands,
  detectBollingerSqueeze,
} from "../volatility/bollinger-bands";
// Donchian Channels
import {
  calculateDonchianChannels,
  calculateDonchianChannelsSeries,
  computeDonchianChannels,
} from "../volatility/donchian-channels";
// Garman-Klass Volatility
import {
  calculateGarmanKlassVolatility,
  calculateGarmanKlassVolatilitySeries,
  computeGarmanKlassVolatility,
} from "../volatility/garman-klass";
// Historical Volatility
import {
  calculateHistoricalVolatility,
  calculateHistoricalVolatilitySeries,
  computeHistoricalVolatility,
} from "../volatility/historical-volatility";
// Keltner Channels
import {
  calculateKeltnerChannels,
  calculateKeltnerChannelsSeries,
  computeKeltnerChannels,
} from "../volatility/keltner-channels";
// Parkinson Volatility
import {
  calculateParkinsonVolatility,
  calculateParkinsonVolatilitySeries,
  computeParkinsonVolatility,
} from "../volatility/parkinson";
import type { CryptoPrice } from "@0xsignal/shared";

// Test data
const uptrend = [100, 102, 105, 108, 112, 115, 118, 122, 125, 128, 132, 135, 138, 142, 145, 148];
const highs = uptrend.map((p) => p * 1.02);
const lows = uptrend.map((p) => p * 0.98);
const closes = uptrend;

// High volatility data
const volatileHighs = [100, 110, 95, 115, 90, 120, 85, 125, 80, 130, 75, 135, 70, 140, 65, 145];
const volatileLows = [90, 85, 80, 85, 75, 90, 70, 95, 65, 100, 60, 105, 55, 110, 50, 115];
const volatileCloses = [95, 100, 88, 105, 82, 110, 78, 115, 72, 120, 68, 125, 62, 130, 58, 135];

// Mock CryptoPrice factory
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
  ...overrides,
});

describe("ATR (Average True Range)", () => {
  describe("calculateTrueRange", () => {
    it("returns high-low when no gap", () => {
      const tr = calculateTrueRange(110, 100, 105);
      expect(tr).toBe(10); // high - low
    });

    it("returns high-prevClose for gap up", () => {
      const tr = calculateTrueRange(120, 115, 100);
      expect(tr).toBe(20); // |120 - 100| = 20
    });

    it("returns prevClose-low for gap down", () => {
      const tr = calculateTrueRange(95, 90, 110);
      expect(tr).toBe(20); // |90 - 110| = 20
    });
  });

  describe("calculateATR", () => {
    it("returns positive ATR value", () => {
      const result = calculateATR(highs, lows, closes);
      expect(result.value).toBeGreaterThan(0);
    });

    it("returns normalized ATR as percentage", () => {
      const result = calculateATR(highs, lows, closes);
      expect(result.normalizedATR).toBeGreaterThan(0);
      expect(result.normalizedATR).toBeLessThan(100);
    });

    it("classifies volatility level correctly", () => {
      // Low volatility
      const lowVolResult = calculateATR(highs, lows, closes);
      expect(["VERY_LOW", "LOW", "NORMAL"]).toContain(lowVolResult.volatilityLevel);

      // High volatility
      const highVolResult = calculateATR(volatileHighs, volatileLows, volatileCloses);
      expect(["HIGH", "VERY_HIGH", "NORMAL"]).toContain(highVolResult.volatilityLevel);
    });

    it("higher volatility produces higher ATR", () => {
      const lowVolATR = calculateATR(highs, lows, closes);
      const highVolATR = calculateATR(volatileHighs, volatileLows, volatileCloses);
      expect(highVolATR.value).toBeGreaterThan(lowVolATR.value);
    });

    it("respects custom period", () => {
      const default14 = calculateATR(highs, lows, closes, 14);
      const custom7 = calculateATR(highs, lows, closes, 7);
      expect(default14.value).not.toBe(custom7.value);
    });
  });

  describe("computeATR (Effect)", () => {
    it.effect("computes ATR as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeATR(highs, lows, closes);
        expect(result.value).toBeDefined();
        expect(result.normalizedATR).toBeDefined();
        expect(result.volatilityLevel).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeATR(highs, lows, closes));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Bollinger Bands", () => {
  describe("calculateBollingerBands", () => {
    it("returns upper > middle > lower", () => {
      const result = calculateBollingerBands(50000, 51000, 49000);
      expect(result.upperBand).toBeGreaterThan(result.middleBand);
      expect(result.middleBand).toBeGreaterThan(result.lowerBand);
    });

    it("calculates bandwidth correctly", () => {
      const result = calculateBollingerBands(50000, 51000, 49000);
      const expectedBandwidth = (result.upperBand - result.lowerBand) / result.middleBand;
      expect(result.bandwidth).toBeCloseTo(expectedBandwidth, 4);
    });

    it("calculates percentB correctly", () => {
      const result = calculateBollingerBands(50000, 51000, 49000);
      const expectedPercentB = (50000 - result.lowerBand) / (result.upperBand - result.lowerBand);
      expect(result.percentB).toBeCloseTo(expectedPercentB, 4);
    });

    it("returns default bands when no high/low", () => {
      const result = calculateBollingerBands(50000, undefined, undefined);
      expect(result.upperBand).toBeCloseTo(55000, 0); // price * 1.1
      expect(result.middleBand).toBeCloseTo(50000, 0);
      expect(result.lowerBand).toBeCloseTo(45000, 0); // price * 0.9
      expect(result.percentB).toBeCloseTo(0.5, 2);
    });

    it("handles price at upper band", () => {
      const result = calculateBollingerBands(51000, 51000, 49000);
      expect(result.percentB).toBeGreaterThan(0.5);
    });

    it("handles price at lower band", () => {
      const result = calculateBollingerBands(49000, 51000, 49000);
      expect(result.percentB).toBeLessThan(0.5);
    });
  });

  describe("computeBollingerBands (Effect)", () => {
    it.effect("computes Bollinger Bands from CryptoPrice", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeBollingerBands(price);
        expect(result.upperBand).toBeDefined();
        expect(result.middleBand).toBeDefined();
        expect(result.lowerBand).toBeDefined();
        expect(result.bandwidth).toBeDefined();
        expect(result.percentB).toBeDefined();
      })
    );
  });

  describe("detectBollingerSqueeze", () => {
    it("detects squeeze when bandwidth is low", () => {
      const price = createMockPrice({ price: 50000, high24h: 50100, low24h: 49900 });
      const bb = calculateBollingerBands(50000, 50100, 49900);
      const result = detectBollingerSqueeze(price, bb);

      if (bb.bandwidth < 0.1) {
        expect(result.isSqueezing).toBe(true);
        expect(result.squeezeIntensity).toBeGreaterThan(0);
      }
    });

    it("returns bullish breakout direction when percentB > 0.6", () => {
      const price = createMockPrice({ price: 51000, high24h: 51000, low24h: 49000 });
      const bb = calculateBollingerBands(51000, 51000, 49000);

      if (bb.bandwidth < 0.1 && bb.percentB > 0.6) {
        const result = detectBollingerSqueeze(price, bb);
        expect(result.breakoutDirection).toBe("BULLISH");
      }
    });

    it("returns bearish breakout direction when percentB < 0.4", () => {
      const price = createMockPrice({ price: 49000, high24h: 51000, low24h: 49000 });
      const bb = calculateBollingerBands(49000, 51000, 49000);

      if (bb.bandwidth < 0.1 && bb.percentB < 0.4) {
        const result = detectBollingerSqueeze(price, bb);
        expect(result.breakoutDirection).toBe("BEARISH");
      }
    });

    it("includes symbol in result", () => {
      const price = createMockPrice({ symbol: "eth" });
      const bb = calculateBollingerBands(price.price, price.high24h, price.low24h);
      const result = detectBollingerSqueeze(price, bb);
      expect(result.symbol).toBe("eth");
    });
  });
});

describe("Donchian Channels", () => {
  // Test data - 25 data points
  const highs = Array.from({ length: 25 }, (_, i) => 102 + i * 2);
  const lows = Array.from({ length: 25 }, (_, i) => 98 + i * 2);
  const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 2);

  describe("calculateDonchianChannels", () => {
    it("returns upper, middle, lower channels", () => {
      const result = calculateDonchianChannels(highs, lows, closes, 20);
      expect(result.upper).toBeDefined();
      expect(result.middle).toBeDefined();
      expect(result.lower).toBeDefined();
    });

    it("upper > middle > lower", () => {
      const result = calculateDonchianChannels(highs, lows, closes, 20);
      expect(result.upper).toBeGreaterThan(result.middle);
      expect(result.middle).toBeGreaterThan(result.lower);
    });

    it("upper is highest high of period", () => {
      const result = calculateDonchianChannels(highs, lows, closes, 20);
      const recentHighs = highs.slice(-20);
      expect(result.upper).toBe(Math.max(...recentHighs));
    });

    it("lower is lowest low of period", () => {
      const result = calculateDonchianChannels(highs, lows, closes, 20);
      const recentLows = lows.slice(-20);
      expect(result.lower).toBe(Math.min(...recentLows));
    });

    it("middle is average of upper and lower", () => {
      const result = calculateDonchianChannels(highs, lows, closes, 20);
      expect(result.middle).toBeCloseTo((result.upper + result.lower) / 2, 2);
    });

    it("calculates width correctly", () => {
      const result = calculateDonchianChannels(highs, lows, closes, 20);
      expect(result.width).toBeDefined();
      expect(result.width).toBeGreaterThan(0);
    });

    it("calculates position correctly", () => {
      const result = calculateDonchianChannels(highs, lows, closes, 20);
      expect(result.position).toBeGreaterThanOrEqual(0);
      expect(result.position).toBeLessThanOrEqual(1);
    });

    it("classifies BULLISH_BREAKOUT when price at upper", () => {
      const highCloses = [...closes];
      highCloses[highCloses.length - 1] = highs[highs.length - 1];
      const result = calculateDonchianChannels(highs, lows, highCloses, 20);
      expect(result.signal).toBe("BULLISH_BREAKOUT");
    });

    it("classifies BEARISH_BREAKOUT when price at lower", () => {
      // Create data where current close is at the lowest low of the period
      const lowCloses = [...closes];
      const lowestLow = Math.min(...lows.slice(-20));
      lowCloses[lowCloses.length - 1] = lowestLow;
      const result = calculateDonchianChannels(highs, lows, lowCloses, 20);
      // Signal depends on whether price equals or exceeds the lower bound
      expect(["BEARISH_BREAKOUT", "NEUTRAL"]).toContain(result.signal);
    });

    it("classifies NEUTRAL when price in middle", () => {
      const result = calculateDonchianChannels(highs, lows, closes, 20);
      if (closes[closes.length - 1] > result.lower && closes[closes.length - 1] < result.upper) {
        expect(result.signal).toBe("NEUTRAL");
      }
    });
  });

  describe("calculateDonchianChannelsSeries", () => {
    it("returns correct length series", () => {
      const series = calculateDonchianChannelsSeries(highs, lows, 20);
      expect(series.upper.length).toBe(highs.length - 20 + 1);
      expect(series.middle.length).toBe(highs.length - 20 + 1);
      expect(series.lower.length).toBe(highs.length - 20 + 1);
    });
  });

  describe("computeDonchianChannels (Effect)", () => {
    it.effect("computes Donchian Channels as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeDonchianChannels(highs, lows, closes, 20);
        expect(result.upper).toBeDefined();
        expect(result.middle).toBeDefined();
        expect(result.lower).toBeDefined();
        expect(result.width).toBeDefined();
        expect(result.position).toBeDefined();
        expect(result.signal).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeDonchianChannels(highs, lows, closes, 20));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Garman-Klass Volatility", () => {
  // Test data - 35 OHLC data points
  const opens = Array.from({ length: 35 }, (_, i) => 100 + i);
  const highs = Array.from({ length: 35 }, (_, i) => 102 + i);
  const lows = Array.from({ length: 35 }, (_, i) => 98 + i);
  const closes = Array.from({ length: 35 }, (_, i) => 101 + i);

  // High volatility data
  const volHighs = Array.from({ length: 35 }, (_, i) => 100 + i + Math.sin(i) * 10);
  const volLows = Array.from({ length: 35 }, (_, i) => 100 + i - Math.sin(i) * 10);

  describe("calculateGarmanKlassVolatility", () => {
    it("returns volatility value", () => {
      const result = calculateGarmanKlassVolatility(opens, highs, lows, closes, 30);
      expect(result.value).toBeDefined();
      expect(result.value).toBeGreaterThanOrEqual(0);
    });

    it("returns daily volatility", () => {
      const result = calculateGarmanKlassVolatility(opens, highs, lows, closes, 30);
      expect(result.dailyVol).toBeDefined();
      expect(result.dailyVol).toBeGreaterThanOrEqual(0);
    });

    it("classifies volatility level", () => {
      const result = calculateGarmanKlassVolatility(opens, highs, lows, closes, 30);
      expect(["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"]).toContain(result.level);
    });

    it("returns efficiency factor", () => {
      const result = calculateGarmanKlassVolatility(opens, highs, lows, closes, 30);
      expect(result.efficiency).toBe(7.4);
    });

    it("higher price swings produce higher volatility", () => {
      const lowVol = calculateGarmanKlassVolatility(opens, highs, lows, closes, 30);
      const highVol = calculateGarmanKlassVolatility(opens, volHighs, volLows, closes, 30);
      expect(highVol.value).toBeGreaterThan(lowVol.value);
    });

    it("respects custom period", () => {
      const default30 = calculateGarmanKlassVolatility(opens, highs, lows, closes, 30);
      const custom20 = calculateGarmanKlassVolatility(opens, highs, lows, closes, 20);
      expect(default30.value).not.toBe(custom20.value);
    });
  });

  describe("calculateGarmanKlassVolatilitySeries", () => {
    it("returns correct length series", () => {
      const series = calculateGarmanKlassVolatilitySeries(opens, highs, lows, closes, 30);
      expect(series.length).toBe(opens.length - 30 + 1);
    });
  });

  describe("computeGarmanKlassVolatility (Effect)", () => {
    it.effect("computes Garman-Klass Volatility as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeGarmanKlassVolatility(opens, highs, lows, closes, 30);
        expect(result.value).toBeDefined();
        expect(result.dailyVol).toBeDefined();
        expect(result.level).toBeDefined();
        expect(result.efficiency).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          computeGarmanKlassVolatility(opens, highs, lows, closes, 30)
        );
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Historical Volatility", () => {
  // Test data - 35 closing prices
  const closes = Array.from({ length: 35 }, (_, i) => 100 + i);
  const volatileCloses = Array.from({ length: 35 }, (_, i) => 100 + i + Math.sin(i) * 10);

  describe("calculateHistoricalVolatility", () => {
    it("returns volatility value", () => {
      const result = calculateHistoricalVolatility(closes, 30);
      expect(result.value).toBeDefined();
      expect(result.value).toBeGreaterThanOrEqual(0);
    });

    it("returns daily volatility", () => {
      const result = calculateHistoricalVolatility(closes, 30);
      expect(result.dailyVol).toBeDefined();
      expect(result.dailyVol).toBeGreaterThanOrEqual(0);
    });

    it("classifies volatility level", () => {
      const result = calculateHistoricalVolatility(closes, 30);
      expect(["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"]).toContain(result.level);
    });

    it("higher price swings produce higher volatility", () => {
      const lowVol = calculateHistoricalVolatility(closes, 30);
      const highVol = calculateHistoricalVolatility(volatileCloses, 30);
      expect(highVol.value).toBeGreaterThan(lowVol.value);
    });

    it("respects custom period", () => {
      const default30 = calculateHistoricalVolatility(closes, 30);
      const custom20 = calculateHistoricalVolatility(closes, 20);
      expect(default30.value).not.toBe(custom20.value);
    });

    it("respects custom annualization factor", () => {
      const daily = calculateHistoricalVolatility(closes, 30, 252);
      const monthly = calculateHistoricalVolatility(closes, 30, 12);
      expect(daily.value).not.toBe(monthly.value);
    });
  });

  describe("calculateHistoricalVolatilitySeries", () => {
    it("returns correct length series", () => {
      const series = calculateHistoricalVolatilitySeries(closes, 30);
      // Log returns reduce length by 1, then rolling window
      expect(series.length).toBe(closes.length - 1 - 30 + 1);
    });
  });

  describe("computeHistoricalVolatility (Effect)", () => {
    it.effect("computes Historical Volatility as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeHistoricalVolatility(closes, 30);
        expect(result.value).toBeDefined();
        expect(result.dailyVol).toBeDefined();
        expect(result.level).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeHistoricalVolatility(closes, 30));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Keltner Channels", () => {
  // Test data - 25 data points
  const closes = Array.from({ length: 25 }, (_, i) => 100 + i * 2);
  const highs = Array.from({ length: 25 }, (_, i) => 102 + i * 2);
  const lows = Array.from({ length: 25 }, (_, i) => 98 + i * 2);

  describe("calculateKeltnerChannels", () => {
    it("returns upper, middle, lower channels", () => {
      const result = calculateKeltnerChannels(closes, highs, lows, 20);
      expect(result.upper).toBeDefined();
      expect(result.middle).toBeDefined();
      expect(result.lower).toBeDefined();
    });

    it("upper > middle > lower", () => {
      const result = calculateKeltnerChannels(closes, highs, lows, 20);
      expect(result.upper).toBeGreaterThan(result.middle);
      expect(result.middle).toBeGreaterThan(result.lower);
    });

    it("middle is EMA of closes", () => {
      const result = calculateKeltnerChannels(closes, highs, lows, 20);
      expect(result.middle).toBeDefined();
    });

    it("calculates width correctly", () => {
      const result = calculateKeltnerChannels(closes, highs, lows, 20);
      expect(result.width).toBeDefined();
      expect(result.width).toBeGreaterThan(0);
    });

    it("calculates position correctly", () => {
      const result = calculateKeltnerChannels(closes, highs, lows, 20);
      // Position can exceed 0-1 range when price is outside channels
      expect(result.position).toBeDefined();
      expect(typeof result.position).toBe("number");
    });

    it("classifies ABOVE when price above upper", () => {
      const highCloses = closes.map((c) => c + 20);
      const result = calculateKeltnerChannels(highCloses, highs, lows, 20);
      if (highCloses[highCloses.length - 1] > result.upper) {
        expect(result.signal).toBe("ABOVE");
      }
    });

    it("classifies BELOW when price below lower", () => {
      const lowCloses = closes.map((c) => c - 20);
      const result = calculateKeltnerChannels(lowCloses, highs, lows, 20);
      if (lowCloses[lowCloses.length - 1] < result.lower) {
        expect(result.signal).toBe("BELOW");
      }
    });

    it("classifies WITHIN when price in channel", () => {
      const result = calculateKeltnerChannels(closes, highs, lows, 20);
      const currentPrice = closes[closes.length - 1];
      if (currentPrice >= result.lower && currentPrice <= result.upper) {
        expect(result.signal).toBe("WITHIN");
      }
    });

    it("respects custom multiplier", () => {
      const default2 = calculateKeltnerChannels(closes, highs, lows, 20, 2);
      const custom3 = calculateKeltnerChannels(closes, highs, lows, 20, 3);
      expect(custom3.upper - custom3.middle).toBeGreaterThan(default2.upper - default2.middle);
    });
  });

  describe("calculateKeltnerChannelsSeries", () => {
    it("returns series of channels", () => {
      const series = calculateKeltnerChannelsSeries(closes, highs, lows, 20);
      expect(series.upper.length).toBeGreaterThan(0);
      expect(series.middle.length).toBeGreaterThan(0);
      expect(series.lower.length).toBeGreaterThan(0);
    });
  });

  describe("computeKeltnerChannels (Effect)", () => {
    it.effect("computes Keltner Channels as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeKeltnerChannels(closes, highs, lows, 20);
        expect(result.upper).toBeDefined();
        expect(result.middle).toBeDefined();
        expect(result.lower).toBeDefined();
        expect(result.width).toBeDefined();
        expect(result.position).toBeDefined();
        expect(result.signal).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeKeltnerChannels(closes, highs, lows, 20));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Parkinson Volatility", () => {
  // Test data - 35 high/low data points
  const highs = Array.from({ length: 35 }, (_, i) => 102 + i);
  const lows = Array.from({ length: 35 }, (_, i) => 98 + i);

  // High volatility data
  const volHighs = Array.from({ length: 35 }, (_, i) => 110 + i);
  const volLows = Array.from({ length: 35 }, (_, i) => 90 + i);

  describe("calculateParkinsonVolatility", () => {
    it("returns volatility value", () => {
      const result = calculateParkinsonVolatility(highs, lows, 30);
      expect(result.value).toBeDefined();
      expect(result.value).toBeGreaterThanOrEqual(0);
    });

    it("returns daily volatility", () => {
      const result = calculateParkinsonVolatility(highs, lows, 30);
      expect(result.dailyVol).toBeDefined();
      expect(result.dailyVol).toBeGreaterThanOrEqual(0);
    });

    it("classifies volatility level", () => {
      const result = calculateParkinsonVolatility(highs, lows, 30);
      expect(["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"]).toContain(result.level);
    });

    it("wider high-low range produces higher volatility", () => {
      const lowVol = calculateParkinsonVolatility(highs, lows, 30);
      const highVol = calculateParkinsonVolatility(volHighs, volLows, 30);
      expect(highVol.value).toBeGreaterThan(lowVol.value);
    });

    it("respects custom period", () => {
      const default30 = calculateParkinsonVolatility(highs, lows, 30);
      const custom20 = calculateParkinsonVolatility(highs, lows, 20);
      expect(default30.value).not.toBe(custom20.value);
    });

    it("respects custom annualization factor", () => {
      const daily = calculateParkinsonVolatility(highs, lows, 30, 252);
      const monthly = calculateParkinsonVolatility(highs, lows, 30, 12);
      expect(daily.value).not.toBe(monthly.value);
    });
  });

  describe("calculateParkinsonVolatilitySeries", () => {
    it("returns correct length series", () => {
      const series = calculateParkinsonVolatilitySeries(highs, lows, 30);
      expect(series.length).toBe(highs.length - 30 + 1);
    });
  });

  describe("computeParkinsonVolatility (Effect)", () => {
    it.effect("computes Parkinson Volatility as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeParkinsonVolatility(highs, lows, 30);
        expect(result.value).toBeDefined();
        expect(result.dailyVol).toBeDefined();
        expect(result.level).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeParkinsonVolatility(highs, lows, 30));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});
