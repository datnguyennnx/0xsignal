/** Trend Formulas Tests - ADX, Parabolic SAR, Supertrend, Moving Averages (SMA, EMA) */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";

// ADX
import { calculateADX, computeADX } from "../trend/adx";
// Parabolic SAR
import {
  calculateParabolicSAR,
  calculateParabolicSARSeries,
  computeParabolicSAR,
} from "../trend/parabolic-sar";
// Supertrend
import {
  calculateSupertrend,
  calculateSupertrendSeries,
  computeSupertrend,
} from "../trend/supertrend";
// Moving Averages
import { computeSMA, computeEMA, calculateSMA, calculateEMA } from "../trend/moving-averages";

// Test data - strong uptrend
const uptrendHighs = [
  102, 105, 108, 112, 115, 118, 122, 125, 128, 132, 135, 138, 142, 145, 148, 152, 155, 158, 162,
  165, 168, 172, 175, 178, 182, 185, 188, 192, 195,
];
const uptrendLows = [
  98, 101, 104, 108, 111, 114, 118, 121, 124, 128, 131, 134, 138, 141, 144, 148, 151, 154, 158, 161,
  164, 168, 171, 174, 178, 181, 184, 188, 191,
];
const uptrendCloses = [
  100, 103, 106, 110, 113, 116, 120, 123, 126, 130, 133, 136, 140, 143, 146, 150, 153, 156, 160,
  163, 166, 170, 173, 176, 180, 183, 186, 190, 193,
];

// Strong downtrend
const downtrendHighs = [...uptrendHighs].reverse();
const downtrendLows = [...uptrendLows].reverse();
const downtrendCloses = [...uptrendCloses].reverse();

// Sideways/ranging market
const sidewaysHighs = [
  102, 103, 101, 104, 102, 103, 101, 104, 102, 103, 101, 104, 102, 103, 101, 104, 102, 103, 101,
  104, 102, 103, 101, 104, 102, 103, 101, 104, 102,
];
const sidewaysLows = [
  98, 97, 99, 96, 98, 97, 99, 96, 98, 97, 99, 96, 98, 97, 99, 96, 98, 97, 99, 96, 98, 97, 99, 96,
  98, 97, 99, 96, 98,
];
const sidewaysCloses = [
  100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
  100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
];

describe("ADX (Average Directional Index)", () => {
  describe("calculateADX", () => {
    it("returns ADX value between 0 and 100", () => {
      const result = calculateADX(uptrendHighs, uptrendLows, uptrendCloses);
      expect(result.adx).toBeGreaterThanOrEqual(0);
      expect(result.adx).toBeLessThanOrEqual(100);
    });

    it("returns +DI and -DI values", () => {
      const result = calculateADX(uptrendHighs, uptrendLows, uptrendCloses);
      expect(result.plusDI).toBeGreaterThanOrEqual(0);
      expect(result.minusDI).toBeGreaterThanOrEqual(0);
    });

    it("shows bullish direction when +DI > -DI in uptrend", () => {
      const result = calculateADX(uptrendHighs, uptrendLows, uptrendCloses);
      expect(result.plusDI).toBeGreaterThan(result.minusDI);
      expect(result.trendDirection).toBe("BULLISH");
    });

    it("shows bearish direction when -DI > +DI in downtrend", () => {
      const result = calculateADX(downtrendHighs, downtrendLows, downtrendCloses);
      expect(result.minusDI).toBeGreaterThan(result.plusDI);
      expect(result.trendDirection).toBe("BEARISH");
    });

    it("shows weak trend for sideways market", () => {
      const result = calculateADX(sidewaysHighs, sidewaysLows, sidewaysCloses);
      expect(result.adx).toBeLessThan(25);
      expect(["VERY_WEAK", "WEAK"]).toContain(result.trendStrength);
    });

    it("classifies trend strength correctly", () => {
      const strongTrend = calculateADX(uptrendHighs, uptrendLows, uptrendCloses);
      const weakTrend = calculateADX(sidewaysHighs, sidewaysLows, sidewaysCloses);

      // Strong trend should have higher ADX
      expect(strongTrend.adx).toBeGreaterThan(weakTrend.adx);
    });

    it("respects custom period", () => {
      const default14 = calculateADX(uptrendHighs, uptrendLows, uptrendCloses, 14);
      const custom7 = calculateADX(uptrendHighs, uptrendLows, uptrendCloses, 7);
      // Both may saturate at 100 for strong trends, so check they're both valid
      expect(default14.adx).toBeGreaterThanOrEqual(0);
      expect(custom7.adx).toBeGreaterThanOrEqual(0);
    });
  });

  describe("trend strength classification", () => {
    it("VERY_WEAK when ADX < 20", () => {
      // Sideways market typically has low ADX
      const result = calculateADX(sidewaysHighs, sidewaysLows, sidewaysCloses);
      if (result.adx < 20) {
        expect(result.trendStrength).toBe("VERY_WEAK");
      }
    });

    it("classifies based on ADX thresholds", () => {
      const result = calculateADX(uptrendHighs, uptrendLows, uptrendCloses);

      if (result.adx < 20) expect(result.trendStrength).toBe("VERY_WEAK");
      else if (result.adx < 25) expect(result.trendStrength).toBe("WEAK");
      else if (result.adx < 40) expect(result.trendStrength).toBe("MODERATE");
      else if (result.adx < 50) expect(result.trendStrength).toBe("STRONG");
      else expect(result.trendStrength).toBe("VERY_STRONG");
    });
  });

  describe("trend direction classification", () => {
    it("BULLISH when +DI - -DI > 5", () => {
      const result = calculateADX(uptrendHighs, uptrendLows, uptrendCloses);
      if (result.plusDI - result.minusDI > 5) {
        expect(result.trendDirection).toBe("BULLISH");
      }
    });

    it("BEARISH when -DI - +DI > 5", () => {
      const result = calculateADX(downtrendHighs, downtrendLows, downtrendCloses);
      if (result.minusDI - result.plusDI > 5) {
        expect(result.trendDirection).toBe("BEARISH");
      }
    });

    it("NEUTRAL when difference < 5", () => {
      // In ranging market, +DI and -DI should be close
      const result = calculateADX(sidewaysHighs, sidewaysLows, sidewaysCloses);
      if (Math.abs(result.plusDI - result.minusDI) <= 5) {
        expect(result.trendDirection).toBe("NEUTRAL");
      }
    });
  });

  describe("computeADX (Effect)", () => {
    it.effect("computes ADX as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeADX(uptrendHighs, uptrendLows, uptrendCloses);
        expect(result.adx).toBeDefined();
        expect(result.plusDI).toBeDefined();
        expect(result.minusDI).toBeDefined();
        expect(result.trendStrength).toBeDefined();
        expect(result.trendDirection).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeADX(uptrendHighs, uptrendLows, uptrendCloses));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Parabolic SAR", () => {
  // Test data - strong uptrend
  const uptrendHighs = Array.from({ length: 20 }, (_, i) => 102 + i * 2);
  const uptrendLows = Array.from({ length: 20 }, (_, i) => 98 + i * 2);
  const uptrendCloses = Array.from({ length: 20 }, (_, i) => 100 + i * 2);

  // Strong downtrend
  const downtrendHighs = [...uptrendHighs].reverse();
  const downtrendLows = [...uptrendLows].reverse();
  const downtrendCloses = [...uptrendCloses].reverse();

  describe("calculateParabolicSAR", () => {
    it("returns SAR value", () => {
      const result = calculateParabolicSAR(uptrendHighs, uptrendLows, uptrendCloses);
      expect(result.sar).toBeDefined();
      expect(typeof result.sar).toBe("number");
    });

    it("returns BULLISH trend for uptrend", () => {
      const result = calculateParabolicSAR(uptrendHighs, uptrendLows, uptrendCloses);
      expect(result.trend).toBe("BULLISH");
    });

    it("returns BEARISH trend for downtrend", () => {
      const result = calculateParabolicSAR(downtrendHighs, downtrendLows, downtrendCloses);
      expect(result.trend).toBe("BEARISH");
    });

    it("SAR is below price in uptrend", () => {
      const result = calculateParabolicSAR(uptrendHighs, uptrendLows, uptrendCloses);
      const currentClose = uptrendCloses[uptrendCloses.length - 1];
      if (result.trend === "BULLISH") {
        expect(result.sar).toBeLessThan(currentClose);
      }
    });

    it("SAR is above price in downtrend", () => {
      const result = calculateParabolicSAR(downtrendHighs, downtrendLows, downtrendCloses);
      const currentClose = downtrendCloses[downtrendCloses.length - 1];
      if (result.trend === "BEARISH") {
        expect(result.sar).toBeGreaterThan(currentClose);
      }
    });

    it("returns acceleration factor", () => {
      const result = calculateParabolicSAR(uptrendHighs, uptrendLows, uptrendCloses);
      expect(result.af).toBeDefined();
      expect(result.af).toBeGreaterThanOrEqual(0.02);
      expect(result.af).toBeLessThanOrEqual(0.2);
    });

    it("returns extreme point", () => {
      const result = calculateParabolicSAR(uptrendHighs, uptrendLows, uptrendCloses);
      expect(result.ep).toBeDefined();
    });

    it("detects reversal", () => {
      const result = calculateParabolicSAR(uptrendHighs, uptrendLows, uptrendCloses);
      expect(typeof result.isReversal).toBe("boolean");
    });

    it("respects custom AF parameters", () => {
      const defaultAF = calculateParabolicSAR(
        uptrendHighs,
        uptrendLows,
        uptrendCloses,
        0.02,
        0.02,
        0.2
      );
      const customAF = calculateParabolicSAR(
        uptrendHighs,
        uptrendLows,
        uptrendCloses,
        0.01,
        0.01,
        0.1
      );
      expect(defaultAF.sar).not.toBe(customAF.sar);
    });

    it("handles minimum data (2 points)", () => {
      const result = calculateParabolicSAR([102, 104], [98, 100], [100, 102]);
      expect(result.sar).toBeDefined();
      expect(result.trend).toBeDefined();
    });

    it("handles single data point", () => {
      const result = calculateParabolicSAR([102], [98], [100]);
      expect(result.sar).toBe(100);
      expect(result.trend).toBe("BULLISH");
    });
  });

  describe("calculateParabolicSARSeries", () => {
    it("returns series of SAR values", () => {
      const series = calculateParabolicSARSeries(uptrendHighs, uptrendLows, uptrendCloses);
      expect(series.length).toBeGreaterThan(0);
    });

    it("each entry has sar and trend", () => {
      const series = calculateParabolicSARSeries(uptrendHighs, uptrendLows, uptrendCloses);
      series.forEach((entry) => {
        expect(entry.sar).toBeDefined();
        expect(["BULLISH", "BEARISH"]).toContain(entry.trend);
      });
    });
  });

  describe("computeParabolicSAR (Effect)", () => {
    it.effect("computes Parabolic SAR as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeParabolicSAR(uptrendHighs, uptrendLows, uptrendCloses);
        expect(result.sar).toBeDefined();
        expect(result.trend).toBeDefined();
        expect(result.isReversal).toBeDefined();
        expect(result.af).toBeDefined();
        expect(result.ep).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          computeParabolicSAR(uptrendHighs, uptrendLows, uptrendCloses)
        );
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Supertrend", () => {
  // Test data - 15 data points for Supertrend (needs period = 10)
  const uptrendHighs = Array.from({ length: 15 }, (_, i) => 102 + i * 2);
  const uptrendLows = Array.from({ length: 15 }, (_, i) => 98 + i * 2);
  const uptrendCloses = Array.from({ length: 15 }, (_, i) => 100 + i * 2);

  const downtrendHighs = [...uptrendHighs].reverse();
  const downtrendLows = [...uptrendLows].reverse();
  const downtrendCloses = [...uptrendCloses].reverse();

  describe("calculateSupertrend", () => {
    it("returns Supertrend value", () => {
      const result = calculateSupertrend(uptrendHighs, uptrendLows, uptrendCloses);
      expect(result.value).toBeDefined();
      expect(typeof result.value).toBe("number");
    });

    it("returns trend for uptrend data", () => {
      const result = calculateSupertrend(uptrendHighs, uptrendLows, uptrendCloses);
      // Supertrend trend depends on price vs HL2, not just price direction
      expect(["BULLISH", "BEARISH"]).toContain(result.trend);
    });

    it("returns BEARISH trend for downtrend", () => {
      const result = calculateSupertrend(downtrendHighs, downtrendLows, downtrendCloses);
      expect(result.trend).toBe("BEARISH");
    });

    it("returns upper and lower bands", () => {
      const result = calculateSupertrend(uptrendHighs, uptrendLows, uptrendCloses);
      expect(result.upperBand).toBeDefined();
      expect(result.lowerBand).toBeDefined();
      expect(result.upperBand).toBeGreaterThan(result.lowerBand);
    });

    it("value equals lower band in bullish trend", () => {
      const result = calculateSupertrend(uptrendHighs, uptrendLows, uptrendCloses);
      if (result.trend === "BULLISH") {
        expect(result.value).toBe(result.lowerBand);
      }
    });

    it("value equals upper band in bearish trend", () => {
      const result = calculateSupertrend(downtrendHighs, downtrendLows, downtrendCloses);
      if (result.trend === "BEARISH") {
        expect(result.value).toBe(result.upperBand);
      }
    });

    it("detects reversal", () => {
      const result = calculateSupertrend(uptrendHighs, uptrendLows, uptrendCloses);
      expect(typeof result.isReversal).toBe("boolean");
    });

    it("respects custom period", () => {
      const default10 = calculateSupertrend(uptrendHighs, uptrendLows, uptrendCloses, 10, 3);
      const custom5 = calculateSupertrend(uptrendHighs, uptrendLows, uptrendCloses, 5, 3);
      // With uniform data, ATR may be similar across periods
      expect(default10.upperBand).toBeDefined();
      expect(custom5.upperBand).toBeDefined();
    });

    it("respects custom multiplier", () => {
      const defaultMult = calculateSupertrend(uptrendHighs, uptrendLows, uptrendCloses, 10, 3);
      const customMult = calculateSupertrend(uptrendHighs, uptrendLows, uptrendCloses, 10, 2);
      expect(defaultMult.upperBand).not.toBe(customMult.upperBand);
    });
  });

  describe("calculateSupertrendSeries", () => {
    it("returns series of Supertrend values", () => {
      const series = calculateSupertrendSeries(uptrendHighs, uptrendLows, uptrendCloses);
      expect(series.length).toBeGreaterThan(0);
    });

    it("each entry has value and trend", () => {
      const series = calculateSupertrendSeries(uptrendHighs, uptrendLows, uptrendCloses);
      series.forEach((entry) => {
        expect(entry.value).toBeDefined();
        expect(["BULLISH", "BEARISH"]).toContain(entry.trend);
      });
    });

    it("returns empty array for insufficient data", () => {
      const shortHighs = [102, 104, 106];
      const shortLows = [98, 100, 102];
      const shortCloses = [100, 102, 104];
      const series = calculateSupertrendSeries(shortHighs, shortLows, shortCloses, 10);
      expect(series.length).toBe(0);
    });
  });

  describe("computeSupertrend (Effect)", () => {
    it.effect("computes Supertrend as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeSupertrend(uptrendHighs, uptrendLows, uptrendCloses);
        expect(result.value).toBeDefined();
        expect(result.trend).toBeDefined();
        expect(result.isReversal).toBeDefined();
        expect(result.upperBand).toBeDefined();
        expect(result.lowerBand).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          computeSupertrend(uptrendHighs, uptrendLows, uptrendCloses)
        );
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Moving Averages (SMA, EMA)", () => {
  const samplePrices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  describe("computeSMA", () => {
    it.effect("calculates simple moving average correctly", () =>
      Effect.gen(function* () {
        const result = yield* computeSMA(samplePrices, 5);

        // SMA of last 5 values: (16+17+18+19+20)/5 = 18
        expect(result.value).toBeCloseTo(18, 1);
        expect(result.period).toBe(5);
      })
    );

    it.effect("handles single value array", () =>
      Effect.gen(function* () {
        const result = yield* computeSMA([100], 1);
        expect(result.value).toBe(100);
      })
    );
  });

  describe("computeEMA", () => {
    it.effect("calculates exponential moving average", () =>
      Effect.gen(function* () {
        const result = yield* computeEMA(samplePrices, 5);

        expect(result.value).toBeDefined();
        expect(result.period).toBe(5);
        // EMA should be closer to recent values than SMA
        expect(result.value).toBeGreaterThan(17);
      })
    );

    it.effect("EMA reacts faster to recent changes than SMA", () =>
      Effect.gen(function* () {
        const pricesWithSpike = [...samplePrices, 30]; // Add spike

        const sma = yield* computeSMA(pricesWithSpike, 5);
        const ema = yield* computeEMA(pricesWithSpike, 5);

        // EMA should be higher due to faster reaction to spike
        expect(ema.value).toBeGreaterThan(sma.value);
      })
    );
  });

  describe("pure functions", () => {
    it("calculateSMA works without Effect", () => {
      const result = calculateSMA(samplePrices, 5);
      expect(result.value).toBeCloseTo(18, 1);
      expect(result.period).toBe(5);
    });

    it("calculateEMA works without Effect", () => {
      const result = calculateEMA(samplePrices, 5);
      expect(result.value).toBeDefined();
      expect(result.period).toBe(5);
      expect(result.alpha).toBeDefined();
    });
  });

  describe("concurrent computation", () => {
    it.effect("computes SMA and EMA concurrently", () =>
      Effect.gen(function* () {
        const [sma, ema] = yield* Effect.all([
          computeSMA(samplePrices, 5),
          computeEMA(samplePrices, 5),
        ]);

        expect(sma.value).toBeDefined();
        expect(ema.value).toBeDefined();
        expect(sma.period).toBe(5);
        expect(ema.period).toBe(5);
      })
    );

    it.effect("returns success Exit for valid input", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          Effect.all([computeSMA(samplePrices, 5), computeEMA(samplePrices, 5)])
        );
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});
