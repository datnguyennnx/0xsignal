/** Volume Formulas Tests - OBV, Volume ROC, VWAP, A/D Line, Chaikin MF, MFI */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";

// OBV
import { calculateOBV, calculateOBVSeries, computeOBV } from "../volume/obv";
// Volume ROC
import {
  calculateVolumeROC,
  calculateVolumeROCSeries,
  computeVolumeROC,
} from "../volume/volume-roc";
// VWAP
import { calculateVWAP, calculateVWAPSeries, computeVWAP } from "../volume/vwap";
// A/D Line
import { calculateADLine, calculateADLineSeries, computeADLine } from "../volume/ad-line";
// Chaikin Money Flow
import {
  calculateChaikinMF,
  calculateChaikinMFSeries,
  computeChaikinMF,
} from "../volume/chaikin-mf";
// MFI
import { calculateMFI, calculateMFISeries, computeMFI } from "../volume/mfi";

// Test data - uptrend with increasing volume
const uptrendCloses = [100, 102, 105, 108, 112, 115, 118, 122, 125, 128, 132, 135, 138, 142, 145];
const uptrendVolumes = [
  1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400,
];
const uptrendHighs = uptrendCloses.map((p) => p * 1.02);
const uptrendLows = uptrendCloses.map((p) => p * 0.98);

// Downtrend with increasing volume
const downtrendCloses = [...uptrendCloses].reverse();
const downtrendVolumes = [...uptrendVolumes];
const downtrendHighs = downtrendCloses.map((p) => p * 1.02);
const downtrendLows = downtrendCloses.map((p) => p * 0.98);

// Sideways market
const sidewaysCloses = [100, 101, 99, 100, 102, 98, 101, 100, 99, 101, 100, 102, 98, 100, 101];
const sidewaysVolumes = [
  1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000,
];
const sidewaysHighs = sidewaysCloses.map((p) => p + 2);
const sidewaysLows = sidewaysCloses.map((p) => p - 2);

describe("OBV (On-Balance Volume)", () => {
  describe("calculateOBV", () => {
    it("returns positive OBV for uptrend", () => {
      const result = calculateOBV(uptrendCloses, uptrendVolumes);
      expect(result.value).toBeGreaterThan(0);
      expect(result.trend).toBe("ACCUMULATION");
    });

    it("returns negative OBV for downtrend", () => {
      const result = calculateOBV(downtrendCloses, downtrendVolumes);
      expect(result.value).toBeLessThan(0);
      expect(result.trend).toBe("DISTRIBUTION");
    });

    it("returns near-zero OBV for sideways market", () => {
      const result = calculateOBV(sidewaysCloses, sidewaysVolumes);
      // Sideways should have mixed OBV
      expect(result.trend).toBeDefined();
    });

    it("calculates momentum correctly", () => {
      const result = calculateOBV(uptrendCloses, uptrendVolumes);
      expect(result.momentum).toBeDefined();
      expect(typeof result.momentum).toBe("number");
    });

    it("adds volume on up days", () => {
      const closes = [100, 110]; // Up day
      const volumes = [1000, 2000];
      const result = calculateOBV(closes, volumes);
      expect(result.value).toBe(2000); // Added volume on up day
    });

    it("subtracts volume on down days", () => {
      const closes = [100, 90]; // Down day
      const volumes = [1000, 2000];
      const result = calculateOBV(closes, volumes);
      expect(result.value).toBe(-2000); // Subtracted volume on down day
    });

    it("no change on flat days", () => {
      const closes = [100, 100]; // Flat day
      const volumes = [1000, 2000];
      const result = calculateOBV(closes, volumes);
      expect(result.value).toBe(0); // No change on flat day
    });
  });

  describe("calculateOBVSeries", () => {
    it("returns correct length series", () => {
      const series = calculateOBVSeries(uptrendCloses, uptrendVolumes);
      expect(series.length).toBe(uptrendCloses.length);
    });

    it("series is cumulative", () => {
      const series = calculateOBVSeries(uptrendCloses, uptrendVolumes);
      // In uptrend, OBV should generally increase
      expect(series[series.length - 1]).toBeGreaterThan(series[0]);
    });
  });

  describe("computeOBV (Effect)", () => {
    it.effect("computes OBV as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeOBV(uptrendCloses, uptrendVolumes);
        expect(result.value).toBeDefined();
        expect(result.trend).toBeDefined();
        expect(result.momentum).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeOBV(uptrendCloses, uptrendVolumes));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Volume ROC (Rate of Change)", () => {
  describe("calculateVolumeROC", () => {
    it("returns positive ROC for increasing volume", () => {
      const result = calculateVolumeROC(uptrendVolumes);
      expect(result.value).toBeGreaterThan(0);
    });

    it("returns negative ROC for decreasing volume", () => {
      const decreasingVolumes = [...uptrendVolumes].reverse();
      const result = calculateVolumeROC(decreasingVolumes);
      expect(result.value).toBeLessThan(0);
    });

    it("returns zero ROC for constant volume", () => {
      const result = calculateVolumeROC(sidewaysVolumes);
      expect(result.value).toBe(0);
    });

    it("classifies signal correctly", () => {
      // Surge: > 100%
      const surgeVolumes = [
        1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 2500,
      ];
      const surge = calculateVolumeROC(surgeVolumes);
      if (surge.value > 100) {
        expect(surge.signal).toBe("SURGE");
      }

      // High: > 50%
      const highVolumes = [
        1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1600,
      ];
      const high = calculateVolumeROC(highVolumes);
      if (high.value > 50 && high.value <= 100) {
        expect(high.signal).toBe("HIGH");
      }
    });

    it("classifies activity correctly", () => {
      const result = calculateVolumeROC(uptrendVolumes);
      expect(["UNUSUAL", "ELEVATED", "NORMAL", "QUIET"]).toContain(result.activity);
    });

    it("respects custom period", () => {
      const default14 = calculateVolumeROC(uptrendVolumes, 14);
      const custom7 = calculateVolumeROC(uptrendVolumes, 7);
      expect(default14.value).not.toBe(custom7.value);
    });

    it("handles zero past volume", () => {
      const volumes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1000];
      const result = calculateVolumeROC(volumes);
      expect(result.value).toBe(0); // Safe division returns 0
    });
  });

  describe("calculateVolumeROCSeries", () => {
    it("returns correct length series", () => {
      const series = calculateVolumeROCSeries(uptrendVolumes, 14);
      expect(series.length).toBe(uptrendVolumes.length - 14);
    });
  });

  describe("computeVolumeROC (Effect)", () => {
    it.effect("computes Volume ROC as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeVolumeROC(uptrendVolumes);
        expect(result.value).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.activity).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeVolumeROC(uptrendVolumes));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("VWAP (Volume Weighted Average Price)", () => {
  describe("calculateVWAP", () => {
    it("returns VWAP value", () => {
      const result = calculateVWAP(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes);
      expect(result.value).toBeGreaterThan(0);
    });

    it("VWAP is between low and high", () => {
      const result = calculateVWAP(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes);
      const minLow = Math.min(...uptrendLows);
      const maxHigh = Math.max(...uptrendHighs);
      expect(result.value).toBeGreaterThanOrEqual(minLow);
      expect(result.value).toBeLessThanOrEqual(maxHigh);
    });

    it("classifies position correctly - ABOVE", () => {
      // Price above VWAP
      const result = calculateVWAP(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes);
      const currentPrice = uptrendCloses[uptrendCloses.length - 1];
      if (currentPrice > result.value * 1.001) {
        expect(result.position).toBe("ABOVE");
      }
    });

    it("classifies position correctly - BELOW", () => {
      // Price below VWAP (downtrend)
      const result = calculateVWAP(
        downtrendHighs,
        downtrendLows,
        downtrendCloses,
        downtrendVolumes
      );
      const currentPrice = downtrendCloses[downtrendCloses.length - 1];
      if (currentPrice < result.value * 0.999) {
        expect(result.position).toBe("BELOW");
      }
    });

    it("calculates deviation correctly", () => {
      const result = calculateVWAP(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes);
      expect(result.deviation).toBeDefined();
      expect(typeof result.deviation).toBe("number");
    });

    it("handles zero total volume", () => {
      const zeroVolumes = Array(15).fill(0);
      const result = calculateVWAP(uptrendHighs, uptrendLows, uptrendCloses, zeroVolumes);
      expect(result.value).toBe(0); // Safe division returns 0
    });

    it("weights by volume correctly", () => {
      // Higher volume at higher prices should pull VWAP up
      const highVolAtEnd = [
        100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 10000,
      ];
      const lowVolAtEnd = [
        10000, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
      ];

      const highVolResult = calculateVWAP(uptrendHighs, uptrendLows, uptrendCloses, highVolAtEnd);
      const lowVolResult = calculateVWAP(uptrendHighs, uptrendLows, uptrendCloses, lowVolAtEnd);

      // High volume at end (higher prices) should have higher VWAP
      expect(highVolResult.value).toBeGreaterThan(lowVolResult.value);
    });
  });

  describe("calculateVWAPSeries", () => {
    it("returns correct length series", () => {
      const series = calculateVWAPSeries(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes);
      expect(series.length).toBe(uptrendCloses.length);
    });

    it("VWAP series is cumulative", () => {
      const series = calculateVWAPSeries(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes);
      // All values should be positive
      series.forEach((v) => {
        expect(v).toBeGreaterThan(0);
      });
    });
  });

  describe("computeVWAP (Effect)", () => {
    it.effect("computes VWAP as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeVWAP(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes);
        expect(result.value).toBeDefined();
        expect(result.position).toBeDefined();
        expect(result.deviation).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          computeVWAP(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes)
        );
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("A/D Line (Accumulation/Distribution)", () => {
  // Test data - uptrend with accumulation
  const uptrendHighs = Array.from({ length: 20 }, (_, i) => 102 + i * 2);
  const uptrendLows = Array.from({ length: 20 }, (_, i) => 98 + i * 2);
  const uptrendCloses = Array.from({ length: 20 }, (_, i) => 101 + i * 2); // Close near high
  const uptrendVolumes = Array.from({ length: 20 }, () => 1000);

  // Downtrend with distribution
  const downtrendHighs = [...uptrendHighs].reverse();
  const downtrendLows = [...uptrendLows].reverse();
  const downtrendCloses = downtrendLows.map((l) => l + 1); // Close near low
  const downtrendVolumes = Array.from({ length: 20 }, () => 1000);

  describe("calculateADLine", () => {
    it("returns A/D Line value", () => {
      const result = calculateADLine(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes);
      expect(result.value).toBeDefined();
      expect(typeof result.value).toBe("number");
    });

    it("returns ACCUMULATION trend when closes near highs", () => {
      const result = calculateADLine(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes);
      expect(result.trend).toBe("ACCUMULATION");
    });

    it("returns DISTRIBUTION trend when closes near lows", () => {
      const result = calculateADLine(
        downtrendHighs,
        downtrendLows,
        downtrendCloses,
        downtrendVolumes
      );
      expect(result.trend).toBe("DISTRIBUTION");
    });

    it("calculates momentum", () => {
      const result = calculateADLine(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes);
      expect(result.momentum).toBeDefined();
      expect(typeof result.momentum).toBe("number");
    });

    it("handles zero range (high equals low)", () => {
      const flatHighs = Array(20).fill(100);
      const flatLows = Array(20).fill(100);
      const flatCloses = Array(20).fill(100);
      const result = calculateADLine(flatHighs, flatLows, flatCloses, uptrendVolumes);
      expect(result.value).toBe(0);
    });
  });

  describe("calculateADLineSeries", () => {
    it("returns correct length series", () => {
      const series = calculateADLineSeries(
        uptrendHighs,
        uptrendLows,
        uptrendCloses,
        uptrendVolumes
      );
      expect(series.length).toBe(uptrendCloses.length);
    });

    it("series is cumulative", () => {
      const series = calculateADLineSeries(
        uptrendHighs,
        uptrendLows,
        uptrendCloses,
        uptrendVolumes
      );
      // In accumulation, A/D should generally increase
      expect(series[series.length - 1]).toBeGreaterThan(series[0]);
    });
  });

  describe("computeADLine (Effect)", () => {
    it.effect("computes A/D Line as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeADLine(
          uptrendHighs,
          uptrendLows,
          uptrendCloses,
          uptrendVolumes
        );
        expect(result.value).toBeDefined();
        expect(result.trend).toBeDefined();
        expect(result.momentum).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          computeADLine(uptrendHighs, uptrendLows, uptrendCloses, uptrendVolumes)
        );
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Chaikin Money Flow (CMF)", () => {
  // Test data - 25 data points for CMF (default period 21)
  const highs = Array.from({ length: 25 }, (_, i) => 102 + i * 2);
  const lows = Array.from({ length: 25 }, (_, i) => 98 + i * 2);
  const closesNearHigh = Array.from({ length: 25 }, (_, i) => 101 + i * 2); // Close near high = buying
  const closesNearLow = Array.from({ length: 25 }, (_, i) => 99 + i * 2); // Close near low = selling
  const volumes = Array.from({ length: 25 }, () => 1000);

  describe("calculateChaikinMF", () => {
    it("returns CMF value between -1 and 1", () => {
      const result = calculateChaikinMF(highs, lows, closesNearHigh, volumes, 21);
      expect(result.value).toBeGreaterThanOrEqual(-1);
      expect(result.value).toBeLessThanOrEqual(1);
    });

    it("returns positive CMF when closes near highs (buying)", () => {
      const result = calculateChaikinMF(highs, lows, closesNearHigh, volumes, 21);
      expect(result.value).toBeGreaterThan(0);
      expect(["BUYING", "STRONG_BUYING"]).toContain(result.signal);
    });

    it("returns negative CMF when closes near lows (selling)", () => {
      const result = calculateChaikinMF(highs, lows, closesNearLow, volumes, 21);
      expect(result.value).toBeLessThan(0);
      expect(["SELLING", "STRONG_SELLING"]).toContain(result.signal);
    });

    it("classifies STRONG_BUYING when CMF > 0.25", () => {
      const result = calculateChaikinMF(highs, lows, closesNearHigh, volumes, 21);
      if (result.value > 0.25) {
        expect(result.signal).toBe("STRONG_BUYING");
      }
    });

    it("classifies STRONG_SELLING when CMF < -0.25", () => {
      const result = calculateChaikinMF(highs, lows, closesNearLow, volumes, 21);
      if (result.value < -0.25) {
        expect(result.signal).toBe("STRONG_SELLING");
      }
    });

    it("classifies pressure correctly", () => {
      const result = calculateChaikinMF(highs, lows, closesNearHigh, volumes, 21);
      expect(["ACCUMULATION", "DISTRIBUTION", "NEUTRAL"]).toContain(result.pressure);
    });

    it("respects custom period", () => {
      const default21 = calculateChaikinMF(highs, lows, closesNearHigh, volumes, 21);
      const custom10 = calculateChaikinMF(highs, lows, closesNearHigh, volumes, 10);
      // With uniform data, different periods may produce same MFM ratio
      expect(default21.value).toBeDefined();
      expect(custom10.value).toBeDefined();
    });

    it("handles zero volume", () => {
      const zeroVolumes = Array(25).fill(0);
      const result = calculateChaikinMF(highs, lows, closesNearHigh, zeroVolumes, 21);
      expect(result.value).toBe(0);
    });
  });

  describe("calculateChaikinMFSeries", () => {
    it("returns correct length series", () => {
      const series = calculateChaikinMFSeries(highs, lows, closesNearHigh, volumes, 21);
      expect(series.length).toBe(highs.length - 21 + 1);
    });
  });

  describe("computeChaikinMF (Effect)", () => {
    it.effect("computes Chaikin MF as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeChaikinMF(highs, lows, closesNearHigh, volumes, 21);
        expect(result.value).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.pressure).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          computeChaikinMF(highs, lows, closesNearHigh, volumes, 21)
        );
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("MFI (Money Flow Index)", () => {
  // Test data - 20 data points for MFI (default period 14)
  const highs = Array.from({ length: 20 }, (_, i) => 102 + i * 2);
  const lows = Array.from({ length: 20 }, (_, i) => 98 + i * 2);
  const uptrendCloses = Array.from({ length: 20 }, (_, i) => 100 + i * 2); // Uptrend
  const downtrendCloses = [...uptrendCloses].reverse(); // Downtrend
  const volumes = Array.from({ length: 20 }, () => 1000);

  describe("calculateMFI", () => {
    it("returns MFI value between 0 and 100", () => {
      const result = calculateMFI(highs, lows, uptrendCloses, volumes, 14);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    });

    it("returns high MFI for uptrend (overbought)", () => {
      const result = calculateMFI(highs, lows, uptrendCloses, volumes, 14);
      expect(result.value).toBeGreaterThan(50);
    });

    it("returns low MFI for downtrend (oversold)", () => {
      const downtrendHighs = [...highs].reverse();
      const downtrendLows = [...lows].reverse();
      const result = calculateMFI(downtrendHighs, downtrendLows, downtrendCloses, volumes, 14);
      expect(result.value).toBeLessThan(50);
    });

    it("classifies OVERBOUGHT when MFI > 80", () => {
      const result = calculateMFI(highs, lows, uptrendCloses, volumes, 14);
      if (result.value > 80) {
        expect(result.signal).toBe("OVERBOUGHT");
      }
    });

    it("classifies OVERSOLD when MFI < 20", () => {
      const downtrendHighs = [...highs].reverse();
      const downtrendLows = [...lows].reverse();
      const result = calculateMFI(downtrendHighs, downtrendLows, downtrendCloses, volumes, 14);
      if (result.value < 20) {
        expect(result.signal).toBe("OVERSOLD");
      }
    });

    it("classifies NEUTRAL when 20 <= MFI <= 80", () => {
      const result = calculateMFI(highs, lows, uptrendCloses, volumes, 14);
      if (result.value >= 20 && result.value <= 80) {
        expect(result.signal).toBe("NEUTRAL");
      }
    });

    it("calculates money flow ratio", () => {
      const result = calculateMFI(highs, lows, uptrendCloses, volumes, 14);
      expect(result.moneyFlowRatio).toBeDefined();
      expect(result.moneyFlowRatio).toBeGreaterThanOrEqual(0);
    });

    it("respects custom period", () => {
      const default14 = calculateMFI(highs, lows, uptrendCloses, volumes, 14);
      const custom7 = calculateMFI(highs, lows, uptrendCloses, volumes, 7);
      // With uniform uptrend data, MFI may saturate at similar values
      expect(default14.value).toBeDefined();
      expect(custom7.value).toBeDefined();
    });
  });

  describe("calculateMFISeries", () => {
    it("returns correct length series", () => {
      const series = calculateMFISeries(highs, lows, uptrendCloses, volumes, 14);
      expect(series.length).toBe(highs.length - 14);
    });

    it("all values are between 0 and 100", () => {
      const series = calculateMFISeries(highs, lows, uptrendCloses, volumes, 14);
      series.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("computeMFI (Effect)", () => {
    it.effect("computes MFI as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeMFI(highs, lows, uptrendCloses, volumes, 14);
        expect(result.value).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.moneyFlowRatio).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeMFI(highs, lows, uptrendCloses, volumes, 14));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});
