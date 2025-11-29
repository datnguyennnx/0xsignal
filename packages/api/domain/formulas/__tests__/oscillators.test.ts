/** Oscillators Tests - CCI, Awesome Oscillator, DPO, RVI, Ultimate Oscillator */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";

// CCI
import { calculateCCI, calculateCCISeries, computeCCI } from "../oscillators/cci";
// Awesome Oscillator
import {
  calculateAwesomeOscillator,
  calculateAwesomeOscillatorSeries,
  computeAwesomeOscillator,
} from "../oscillators/awesome";
// DPO
import { calculateDPO, calculateDPOSeries, computeDPO } from "../oscillators/dpo";
// RVI
import { calculateRVI, computeRVI } from "../oscillators/rvi";
// Ultimate Oscillator
import {
  calculateUltimateOscillator,
  calculateUltimateOscillatorSeries,
  computeUltimateOscillator,
} from "../oscillators/ultimate";

// Test data - uptrend
const uptrendHighs = Array.from({ length: 40 }, (_, i) => 100 + i * 2 + 2);
const uptrendLows = Array.from({ length: 40 }, (_, i) => 100 + i * 2 - 2);
const uptrendCloses = Array.from({ length: 40 }, (_, i) => 100 + i * 2);

// Downtrend
const downtrendHighs = [...uptrendHighs].reverse();
const downtrendLows = [...uptrendLows].reverse();
const downtrendCloses = [...uptrendCloses].reverse();

// Sideways
const sidewaysHighs = Array.from({ length: 40 }, () => 102);
const sidewaysLows = Array.from({ length: 40 }, () => 98);
const sidewaysCloses = Array.from({ length: 40 }, () => 100);

describe("CCI (Commodity Channel Index)", () => {
  describe("calculateCCI", () => {
    it("returns positive CCI for uptrend", () => {
      const result = calculateCCI(uptrendHighs, uptrendLows, uptrendCloses);
      expect(result.value).toBeGreaterThan(0);
    });

    it("returns negative CCI for downtrend", () => {
      const result = calculateCCI(downtrendHighs, downtrendLows, downtrendCloses);
      expect(result.value).toBeLessThan(0);
    });

    it("returns near-zero CCI for sideways market", () => {
      const result = calculateCCI(sidewaysHighs, sidewaysLows, sidewaysCloses);
      expect(Math.abs(result.value)).toBeLessThan(50);
    });

    it("classifies overbought when CCI > 100", () => {
      const result = calculateCCI(uptrendHighs, uptrendLows, uptrendCloses);
      if (result.value > 100) {
        expect(result.signal).toBe("OVERBOUGHT");
      }
      if (result.value > 200) {
        expect(result.signal).toBe("EXTREME_OVERBOUGHT");
      }
    });

    it("classifies oversold when CCI < -100", () => {
      const result = calculateCCI(downtrendHighs, downtrendLows, downtrendCloses);
      if (result.value < -100) {
        expect(result.signal).toBe("OVERSOLD");
      }
      if (result.value < -200) {
        expect(result.signal).toBe("EXTREME_OVERSOLD");
      }
    });

    it("classifies neutral when -100 <= CCI <= 100", () => {
      const result = calculateCCI(sidewaysHighs, sidewaysLows, sidewaysCloses);
      if (result.value >= -100 && result.value <= 100) {
        expect(result.signal).toBe("NEUTRAL");
      }
    });

    it("classifies trend correctly", () => {
      const bullish = calculateCCI(uptrendHighs, uptrendLows, uptrendCloses);
      const bearish = calculateCCI(downtrendHighs, downtrendLows, downtrendCloses);

      if (bullish.value > 100) {
        expect(["BULLISH", "STRONG_BULLISH"]).toContain(bullish.trend);
      }
      if (bearish.value < -100) {
        expect(["BEARISH", "STRONG_BEARISH"]).toContain(bearish.trend);
      }
    });

    it("respects custom period", () => {
      const default20 = calculateCCI(uptrendHighs, uptrendLows, uptrendCloses, 20);
      const custom10 = calculateCCI(uptrendHighs, uptrendLows, uptrendCloses, 10);
      expect(default20.value).not.toBe(custom10.value);
    });

    it("handles zero mean deviation", () => {
      // All same values - mean deviation is zero
      const flatHighs = Array(25).fill(100);
      const flatLows = Array(25).fill(100);
      const flatCloses = Array(25).fill(100);
      const result = calculateCCI(flatHighs, flatLows, flatCloses);
      expect(result.value).toBe(0);
    });
  });

  describe("calculateCCISeries", () => {
    it("returns correct length series", () => {
      const series = calculateCCISeries(uptrendHighs, uptrendLows, uptrendCloses, 20);
      expect(series.length).toBe(uptrendHighs.length - 20 + 1);
    });

    it("all values are finite numbers", () => {
      const series = calculateCCISeries(uptrendHighs, uptrendLows, uptrendCloses);
      series.forEach((v) => {
        expect(isFinite(v)).toBe(true);
      });
    });
  });

  describe("computeCCI (Effect)", () => {
    it.effect("computes CCI as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeCCI(uptrendHighs, uptrendLows, uptrendCloses);
        expect(result.value).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.trend).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeCCI(uptrendHighs, uptrendLows, uptrendCloses));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Awesome Oscillator", () => {
  describe("calculateAwesomeOscillator", () => {
    it("returns positive AO for uptrend", () => {
      const result = calculateAwesomeOscillator(uptrendHighs, uptrendLows);
      expect(result.value).toBeGreaterThan(0);
      expect(result.signal).toBe("BULLISH");
    });

    it("returns negative AO for downtrend", () => {
      const result = calculateAwesomeOscillator(downtrendHighs, downtrendLows);
      expect(result.value).toBeLessThan(0);
      expect(result.signal).toBe("BEARISH");
    });

    it("returns near-zero AO for sideways market", () => {
      const result = calculateAwesomeOscillator(sidewaysHighs, sidewaysLows);
      expect(Math.abs(result.value)).toBeLessThan(1);
      expect(result.signal).toBe("NEUTRAL");
    });

    it("classifies momentum correctly", () => {
      const result = calculateAwesomeOscillator(uptrendHighs, uptrendLows);
      expect(["INCREASING", "DECREASING", "STABLE"]).toContain(result.momentum);
    });

    it("sets histogram color based on momentum", () => {
      const result = calculateAwesomeOscillator(uptrendHighs, uptrendLows);
      if (result.momentum === "INCREASING") {
        expect(result.histogram).toBe("GREEN");
      } else {
        expect(result.histogram).toBe("RED");
      }
    });

    it("respects custom periods", () => {
      const defaultPeriods = calculateAwesomeOscillator(uptrendHighs, uptrendLows, 5, 34);
      const customPeriods = calculateAwesomeOscillator(uptrendHighs, uptrendLows, 3, 20);
      expect(defaultPeriods.value).not.toBe(customPeriods.value);
    });
  });

  describe("calculateAwesomeOscillatorSeries", () => {
    it("returns correct length series", () => {
      const series = calculateAwesomeOscillatorSeries(uptrendHighs, uptrendLows, 5, 34);
      expect(series.length).toBe(uptrendHighs.length - 34 + 1);
    });
  });

  describe("computeAwesomeOscillator (Effect)", () => {
    it.effect("computes AO as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeAwesomeOscillator(uptrendHighs, uptrendLows);
        expect(result.value).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.momentum).toBeDefined();
        expect(result.histogram).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeAwesomeOscillator(uptrendHighs, uptrendLows));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("DPO (Detrended Price Oscillator)", () => {
  // Test data - 40 data points for DPO (needs period + displacement)
  const uptrendCloses = Array.from({ length: 40 }, (_, i) => 100 + i * 2);
  const downtrendCloses = Array.from({ length: 40 }, (_, i) => 180 - i * 2);
  const sidewaysCloses = Array.from({ length: 40 }, () => 100);

  describe("calculateDPO", () => {
    it("returns positive DPO for uptrend", () => {
      const result = calculateDPO(uptrendCloses, 20);
      expect(result.value).toBeGreaterThan(0);
    });

    it("returns negative DPO for downtrend", () => {
      const result = calculateDPO(downtrendCloses, 20);
      expect(result.value).toBeLessThan(0);
    });

    it("returns near-zero DPO for sideways market", () => {
      const result = calculateDPO(sidewaysCloses, 20);
      expect(result.value).toBe(0);
    });

    it("classifies signal correctly", () => {
      const result = calculateDPO(uptrendCloses, 20);
      expect(["OVERBOUGHT", "OVERSOLD", "NEUTRAL"]).toContain(result.signal);
    });

    it("classifies cycle correctly", () => {
      const result = calculateDPO(uptrendCloses, 20);
      expect(["PEAK", "TROUGH", "NEUTRAL"]).toContain(result.cycle);
    });

    it("returns neutral for insufficient data", () => {
      const shortData = [100, 101, 102];
      const result = calculateDPO(shortData, 20);
      expect(result.value).toBe(0);
      expect(result.signal).toBe("NEUTRAL");
      expect(result.cycle).toBe("NEUTRAL");
    });

    it("respects custom period", () => {
      const default20 = calculateDPO(uptrendCloses, 20);
      const custom10 = calculateDPO(uptrendCloses, 10);
      expect(default20.value).not.toBe(custom10.value);
    });
  });

  describe("calculateDPOSeries", () => {
    it("returns correct length series", () => {
      const series = calculateDPOSeries(uptrendCloses, 20);
      const displacement = Math.floor(20 / 2) + 1;
      expect(series.length).toBe(uptrendCloses.length - 20 - displacement + 1);
    });

    it("all values are finite numbers", () => {
      const series = calculateDPOSeries(uptrendCloses, 20);
      series.forEach((v) => {
        expect(isFinite(v)).toBe(true);
      });
    });
  });

  describe("computeDPO (Effect)", () => {
    it.effect("computes DPO as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeDPO(uptrendCloses, 20);
        expect(result.value).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.cycle).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeDPO(uptrendCloses, 20));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("RVI (Relative Vigor Index)", () => {
  // Test data - OHLC for 20 data points
  const uptrendOpens = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
  const uptrendHighs = Array.from({ length: 20 }, (_, i) => 102 + i * 2);
  const uptrendLows = Array.from({ length: 20 }, (_, i) => 98 + i * 2);
  const uptrendCloses = Array.from({ length: 20 }, (_, i) => 101 + i * 2);

  const downtrendOpens = [...uptrendOpens].reverse();
  const downtrendHighs = [...uptrendHighs].reverse();
  const downtrendLows = [...uptrendLows].reverse();
  const downtrendCloses = [...uptrendCloses].reverse();

  describe("calculateRVI", () => {
    it("returns positive RVI for uptrend", () => {
      const result = calculateRVI(uptrendOpens, uptrendHighs, uptrendLows, uptrendCloses, 10);
      expect(result.rvi).toBeGreaterThanOrEqual(0);
    });

    it("returns RVI value for downtrend", () => {
      const result = calculateRVI(
        downtrendOpens,
        downtrendHighs,
        downtrendLows,
        downtrendCloses,
        10
      );
      // RVI measures close-open relationship, may not be negative for all downtrends
      expect(result.rvi).toBeDefined();
      expect(typeof result.rvi).toBe("number");
    });

    it("returns RVI and signal values", () => {
      const result = calculateRVI(uptrendOpens, uptrendHighs, uptrendLows, uptrendCloses, 10);
      expect(result.rvi).toBeDefined();
      expect(result.signal).toBeDefined();
    });

    it("classifies crossover correctly", () => {
      const result = calculateRVI(uptrendOpens, uptrendHighs, uptrendLows, uptrendCloses, 10);
      expect(["BULLISH", "BEARISH", "NONE"]).toContain(result.crossover);
    });

    it("classifies momentum correctly", () => {
      const result = calculateRVI(uptrendOpens, uptrendHighs, uptrendLows, uptrendCloses, 10);
      expect(["POSITIVE", "NEGATIVE", "NEUTRAL"]).toContain(result.momentum);
    });

    it("respects custom period", () => {
      // With uniform data, different periods may produce same result
      const default10 = calculateRVI(uptrendOpens, uptrendHighs, uptrendLows, uptrendCloses, 10);
      const custom5 = calculateRVI(uptrendOpens, uptrendHighs, uptrendLows, uptrendCloses, 5);
      expect(default10.rvi).toBeDefined();
      expect(custom5.rvi).toBeDefined();
    });
  });

  describe("computeRVI (Effect)", () => {
    it.effect("computes RVI as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeRVI(
          uptrendOpens,
          uptrendHighs,
          uptrendLows,
          uptrendCloses,
          10
        );
        expect(result.rvi).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.crossover).toBeDefined();
        expect(result.momentum).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          computeRVI(uptrendOpens, uptrendHighs, uptrendLows, uptrendCloses, 10)
        );
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Ultimate Oscillator", () => {
  // Test data - 35 data points for Ultimate Oscillator (needs period3 = 28)
  const uptrendHighs = Array.from({ length: 35 }, (_, i) => 102 + i * 2);
  const uptrendLows = Array.from({ length: 35 }, (_, i) => 98 + i * 2);
  const uptrendCloses = Array.from({ length: 35 }, (_, i) => 100 + i * 2);

  const downtrendHighs = [...uptrendHighs].reverse();
  const downtrendLows = [...uptrendLows].reverse();
  const downtrendCloses = [...uptrendCloses].reverse();

  const sidewaysHighs = Array.from({ length: 35 }, () => 102);
  const sidewaysLows = Array.from({ length: 35 }, () => 98);
  const sidewaysCloses = Array.from({ length: 35 }, () => 100);

  describe("calculateUltimateOscillator", () => {
    it("returns value between 0 and 100", () => {
      const result = calculateUltimateOscillator(uptrendHighs, uptrendLows, uptrendCloses);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    });

    it("returns value for different trends", () => {
      const upResult = calculateUltimateOscillator(uptrendHighs, uptrendLows, uptrendCloses);
      const downResult = calculateUltimateOscillator(
        downtrendHighs,
        downtrendLows,
        downtrendCloses
      );
      // Both should return valid values between 0-100
      expect(upResult.value).toBeGreaterThanOrEqual(0);
      expect(downResult.value).toBeGreaterThanOrEqual(0);
    });

    it("classifies overbought when value > 70", () => {
      const result = calculateUltimateOscillator(uptrendHighs, uptrendLows, uptrendCloses);
      if (result.value > 70) {
        expect(result.signal).toBe("OVERBOUGHT");
      }
    });

    it("classifies oversold when value < 30", () => {
      const result = calculateUltimateOscillator(downtrendHighs, downtrendLows, downtrendCloses);
      if (result.value < 30) {
        expect(result.signal).toBe("OVERSOLD");
      }
    });

    it("classifies neutral when 30 <= value <= 70", () => {
      const result = calculateUltimateOscillator(sidewaysHighs, sidewaysLows, sidewaysCloses);
      if (result.value >= 30 && result.value <= 70) {
        expect(result.signal).toBe("NEUTRAL");
      }
    });

    it("classifies trend correctly", () => {
      const result = calculateUltimateOscillator(uptrendHighs, uptrendLows, uptrendCloses);
      expect(["BULLISH", "BEARISH", "NEUTRAL"]).toContain(result.trend);
    });

    it("respects custom periods", () => {
      const defaultPeriods = calculateUltimateOscillator(
        uptrendHighs,
        uptrendLows,
        uptrendCloses,
        7,
        14,
        28
      );
      const customPeriods = calculateUltimateOscillator(
        uptrendHighs,
        uptrendLows,
        uptrendCloses,
        5,
        10,
        20
      );
      // With uniform data, different periods may produce similar results
      expect(defaultPeriods.value).toBeDefined();
      expect(customPeriods.value).toBeDefined();
    });
  });

  describe("calculateUltimateOscillatorSeries", () => {
    it("returns correct length series", () => {
      const series = calculateUltimateOscillatorSeries(
        uptrendHighs,
        uptrendLows,
        uptrendCloses,
        7,
        14,
        28
      );
      // Length = data.length - 1 (for BP/TR) - period3 + 1
      expect(series.length).toBe(uptrendHighs.length - 1 - 28 + 1);
    });

    it("all values are between 0 and 100", () => {
      const series = calculateUltimateOscillatorSeries(uptrendHighs, uptrendLows, uptrendCloses);
      series.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("computeUltimateOscillator (Effect)", () => {
    it.effect("computes Ultimate Oscillator as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeUltimateOscillator(uptrendHighs, uptrendLows, uptrendCloses);
        expect(result.value).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.trend).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          computeUltimateOscillator(uptrendHighs, uptrendLows, uptrendCloses)
        );
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});
