import { it, expect, describe } from "@effect/vitest";
import { Effect, Exit } from "effect";

import { computeMACDFromHistory, type MACDHistoricalResult } from "../momentum/macd";
import { calculateStochastic, computeStochastic } from "../momentum/stochastic";
import { calculateROC, calculateROCSeries, computeROC } from "../momentum/roc";
import { calculateMomentum, calculateMomentumSeries, computeMomentum } from "../momentum/momentum";
import {
  calculateWilliamsR,
  calculateWilliamsRSeries,
  computeWilliamsR,
} from "../momentum/williams-r";
import { computeRSIFromHistory } from "../momentum/rsi";

const uptrend = [
  100, 102, 105, 108, 112, 115, 118, 122, 125, 128, 132, 135, 138, 142, 145, 148, 152, 155, 158,
  162, 165, 168, 172, 175, 178, 182, 185, 188, 192, 195, 198, 202, 205, 208, 212, 215, 218, 222,
  225, 228, 232, 235,
];
const downtrend = [
  235, 232, 228, 225, 222, 218, 215, 212, 208, 205, 202, 198, 195, 192, 188, 185, 182, 178, 175,
  172, 168, 165, 162, 158, 155, 152, 148, 145, 142, 138, 135, 132, 128, 125, 122, 118, 115, 112,
  108, 105, 102, 100,
];
const sideways = [
  100, 102, 99, 101, 100, 103, 98, 102, 100, 101, 99, 100, 102, 98, 101, 100, 99, 102, 100, 101, 99,
  100, 102, 98, 101, 100, 99, 101, 103, 98, 100, 102, 99, 101, 100, 98, 102, 100, 101, 99, 100, 102,
];
const highs = uptrend.map((p) => p * 1.02);
const lows = uptrend.map((p) => p * 0.98);

describe("MACD", () => {
  describe("computeMACDFromHistory", () => {
    it.effect("returns positive MACD for uptrend", () =>
      Effect.gen(function* () {
        const result = yield* computeMACDFromHistory(uptrend);
        expect(result.macd).toBeGreaterThan(0);
        expect(["BULLISH", "NEUTRAL"]).toContain(result.trend);
      })
    );

    it.effect("returns negative MACD for downtrend", () =>
      Effect.gen(function* () {
        const result = yield* computeMACDFromHistory(downtrend);
        expect(result.macd).toBeLessThan(0);
        expect(["BEARISH", "NEUTRAL"]).toContain(result.trend);
      })
    );

    it.effect("returns neutral for sideways market", () =>
      Effect.gen(function* () {
        const result = yield* computeMACDFromHistory(sideways);
        expect(Math.abs(result.macd)).toBeLessThan(5);
      })
    );

    it.effect("calculates histogram correctly", () =>
      Effect.gen(function* () {
        const result = yield* computeMACDFromHistory(uptrend);
        expect(result.histogram).toBeDefined();
        if (!isNaN(result.histogram)) {
          expect(result.histogram).toBeCloseTo(result.macd - result.signal, 2);
        }
      })
    );

    it.effect("respects custom periods", () =>
      Effect.gen(function* () {
        const defaultResult = yield* computeMACDFromHistory(uptrend);
        const customResult = yield* computeMACDFromHistory(uptrend, 8, 17, 9);
        expect(customResult.macd).not.toBe(defaultResult.macd);
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeMACDFromHistory(uptrend));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Stochastic Oscillator", () => {
  describe("calculateStochastic", () => {
    it("returns overbought signal when price near high", () => {
      const closes = [...Array(20)].map((_, i) => 100 + i);
      const highsArr = closes.map((p) => p + 2);
      const lowsArr = closes.map((p) => p - 10);

      const result = calculateStochastic(closes, highsArr, lowsArr);
      expect(result.k).toBeGreaterThan(70);
      expect(result.signal).toBe("OVERBOUGHT");
    });

    it("returns oversold signal when price near low", () => {
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
      expect(result.k).toBe(50);
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
      const closes = highs.map((h) => h - 0.5);
      const result = calculateWilliamsR(closes, highs, lows);
      expect(result.value).toBeGreaterThan(-20);
      expect(result.signal).toBe("OVERBOUGHT");
    });

    it("returns value in valid range when price near low", () => {
      const testHighs = [110, 112, 115, 118, 120, 122, 125, 128, 130, 132, 135, 138, 140, 142, 145];
      const testLows = [90, 92, 95, 98, 100, 102, 105, 108, 110, 112, 115, 118, 120, 122, 125];
      const testCloses = testLows.map((l) => l + 1);
      const result = calculateWilliamsR(testCloses, testHighs, testLows);
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
      expect(result.value).toBe(-50);
    });

    it("classifies momentum based on value threshold", () => {
      const result = calculateWilliamsR(uptrend, highs, lows);
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
  describe("computeRSIFromHistory", () => {
    it.effect("computes RSI from historical closes", () =>
      Effect.gen(function* () {
        const result = yield* computeRSIFromHistory(uptrend);
        expect(result.rsi).toBeGreaterThan(50);
        expect(result.signal).toBeDefined();
        expect(result.avgGain).toBeGreaterThan(0);
      })
    );

    it.effect("returns neutral RSI for sideways", () =>
      Effect.gen(function* () {
        const result = yield* computeRSIFromHistory(sideways);
        expect(result.rsi).toBeGreaterThan(30);
        expect(result.rsi).toBeLessThan(70);
        expect(result.signal).toBe("NEUTRAL");
      })
    );

    it.effect("returns low RSI for downtrend", () =>
      Effect.gen(function* () {
        const result = yield* computeRSIFromHistory(downtrend);
        expect(result.rsi).toBeLessThan(50);
        expect(result.avgLoss).toBeGreaterThan(0);
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeRSIFromHistory(uptrend));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );

    it.effect("handles insufficient data gracefully", () =>
      Effect.gen(function* () {
        const shortData = [100, 102, 105];
        const result = yield* computeRSIFromHistory(shortData);
        expect(result.rsi).toBe(50);
        expect(result.signal).toBe("NEUTRAL");
      })
    );
  });
});
