import { it, expect, describe } from "@effect/vitest";
import { Effect, Exit } from "effect";

import { computeADXFromHistory } from "../trend/adx";
import {
  calculateParabolicSAR,
  calculateParabolicSARSeries,
  computeParabolicSAR,
} from "../trend/parabolic-sar";
import { computeSMA, computeEMA, calculateSMA, calculateEMA } from "../trend/moving-averages";

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

const downtrendHighs = [...uptrendHighs].reverse();
const downtrendLows = [...uptrendLows].reverse();
const downtrendCloses = [...uptrendCloses].reverse();

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
  describe("computeADXFromHistory", () => {
    it.effect("returns ADX value between 0 and 100", () =>
      Effect.gen(function* () {
        const result = yield* computeADXFromHistory(uptrendHighs, uptrendLows, uptrendCloses);
        expect(result.adx).toBeGreaterThanOrEqual(0);
        expect(result.adx).toBeLessThanOrEqual(100);
      })
    );

    it.effect("returns +DI and -DI values", () =>
      Effect.gen(function* () {
        const result = yield* computeADXFromHistory(uptrendHighs, uptrendLows, uptrendCloses);
        expect(result.plusDI).toBeGreaterThanOrEqual(0);
        expect(result.minusDI).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("shows bullish direction in uptrend", () =>
      Effect.gen(function* () {
        const result = yield* computeADXFromHistory(uptrendHighs, uptrendLows, uptrendCloses);
        expect(result.plusDI).toBeGreaterThan(result.minusDI);
        expect(result.direction).toBe("BULLISH");
      })
    );

    it.effect("shows bearish direction in downtrend", () =>
      Effect.gen(function* () {
        const result = yield* computeADXFromHistory(downtrendHighs, downtrendLows, downtrendCloses);
        expect(result.minusDI).toBeGreaterThan(result.plusDI);
        expect(result.direction).toBe("BEARISH");
      })
    );

    it.effect("shows weak trend for sideways market", () =>
      Effect.gen(function* () {
        const result = yield* computeADXFromHistory(sidewaysHighs, sidewaysLows, sidewaysCloses);
        expect(result.adx).toBeLessThan(25);
        expect(["NONE", "WEAK"]).toContain(result.trend);
      })
    );

    it.effect("classifies trend strength correctly", () =>
      Effect.gen(function* () {
        const strongTrend = yield* computeADXFromHistory(uptrendHighs, uptrendLows, uptrendCloses);
        const weakTrend = yield* computeADXFromHistory(sidewaysHighs, sidewaysLows, sidewaysCloses);
        expect(strongTrend.adx).toBeGreaterThan(weakTrend.adx);
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          computeADXFromHistory(uptrendHighs, uptrendLows, uptrendCloses)
        );
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Parabolic SAR", () => {
  const sarUptrendHighs = Array.from({ length: 20 }, (_, i) => 102 + i * 2);
  const sarUptrendLows = Array.from({ length: 20 }, (_, i) => 98 + i * 2);
  const sarUptrendCloses = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
  const sarDowntrendHighs = [...sarUptrendHighs].reverse();
  const sarDowntrendLows = [...sarUptrendLows].reverse();
  const sarDowntrendCloses = [...sarUptrendCloses].reverse();

  describe("calculateParabolicSAR", () => {
    it("returns SAR value", () => {
      const result = calculateParabolicSAR(sarUptrendHighs, sarUptrendLows, sarUptrendCloses);
      expect(result.sar).toBeDefined();
      expect(typeof result.sar).toBe("number");
    });

    it("returns BULLISH trend for uptrend", () => {
      const result = calculateParabolicSAR(sarUptrendHighs, sarUptrendLows, sarUptrendCloses);
      expect(result.trend).toBe("BULLISH");
    });

    it("returns BEARISH trend for downtrend", () => {
      const result = calculateParabolicSAR(sarDowntrendHighs, sarDowntrendLows, sarDowntrendCloses);
      expect(result.trend).toBe("BEARISH");
    });

    it("SAR is below price in uptrend", () => {
      const result = calculateParabolicSAR(sarUptrendHighs, sarUptrendLows, sarUptrendCloses);
      const currentClose = sarUptrendCloses[sarUptrendCloses.length - 1];
      if (result.trend === "BULLISH") {
        expect(result.sar).toBeLessThan(currentClose);
      }
    });

    it("returns acceleration factor", () => {
      const result = calculateParabolicSAR(sarUptrendHighs, sarUptrendLows, sarUptrendCloses);
      expect(result.af).toBeDefined();
      expect(result.af).toBeGreaterThanOrEqual(0.02);
      expect(result.af).toBeLessThanOrEqual(0.2);
    });

    it("returns extreme point", () => {
      const result = calculateParabolicSAR(sarUptrendHighs, sarUptrendLows, sarUptrendCloses);
      expect(result.ep).toBeDefined();
    });

    it("detects reversal", () => {
      const result = calculateParabolicSAR(sarUptrendHighs, sarUptrendLows, sarUptrendCloses);
      expect(typeof result.isReversal).toBe("boolean");
    });
  });

  describe("calculateParabolicSARSeries", () => {
    it("returns series of SAR values", () => {
      const series = calculateParabolicSARSeries(sarUptrendHighs, sarUptrendLows, sarUptrendCloses);
      expect(series.length).toBeGreaterThan(0);
    });

    it("each entry has sar and trend", () => {
      const series = calculateParabolicSARSeries(sarUptrendHighs, sarUptrendLows, sarUptrendCloses);
      series.forEach((entry) => {
        expect(entry.sar).toBeDefined();
        expect(["BULLISH", "BEARISH"]).toContain(entry.trend);
      });
    });
  });

  describe("computeParabolicSAR (Effect)", () => {
    it.effect("computes Parabolic SAR as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeParabolicSAR(
          sarUptrendHighs,
          sarUptrendLows,
          sarUptrendCloses
        );
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
          computeParabolicSAR(sarUptrendHighs, sarUptrendLows, sarUptrendCloses)
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
        expect(result.value).toBeGreaterThan(17);
      })
    );

    it.effect("EMA reacts faster to recent changes than SMA", () =>
      Effect.gen(function* () {
        const pricesWithSpike = [...samplePrices, 30];

        const sma = yield* computeSMA(pricesWithSpike, 5);
        const ema = yield* computeEMA(pricesWithSpike, 5);

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
