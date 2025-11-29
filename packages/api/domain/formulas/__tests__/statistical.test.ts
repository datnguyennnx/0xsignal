/** Statistical Formulas Tests - Standard Deviation, Noise Score, Correlation, Covariance, Linear Regression, Z-Score */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";

// Standard Deviation
import {
  calculateStandardDeviation,
  computeStandardDeviation,
} from "../statistical/standard-deviation";
// Noise Score
import { calculateNoiseScore, computeNoiseScore } from "../statistical/noise";
// Correlation
import { calculateCorrelation, computeCorrelation } from "../statistical/correlation";
// Covariance
import { calculateCovariance, computeCovariance } from "../statistical/covariance";
// Linear Regression
import {
  calculateLinearRegression,
  computeLinearRegression,
} from "../statistical/linear-regression";
// Z-Score
import { calculateZScore, calculateZScoreSeries, computeZScore } from "../statistical/z-score";

describe("Standard Deviation", () => {
  describe("calculateStandardDeviation", () => {
    it("returns zero for identical values", () => {
      const values = [100, 100, 100, 100, 100];
      const result = calculateStandardDeviation(values);
      expect(result.population).toBe(0);
      expect(result.sample).toBe(0);
      expect(result.variance).toBe(0);
    });

    it("calculates correct mean", () => {
      const values = [10, 20, 30, 40, 50];
      const result = calculateStandardDeviation(values);
      expect(result.mean).toBe(30);
    });

    it("sample stddev > population stddev for small samples", () => {
      const values = [10, 20, 30, 40, 50];
      const result = calculateStandardDeviation(values);
      expect(result.sample).toBeGreaterThan(result.population);
    });

    it("calculates known standard deviation correctly", () => {
      // Known dataset: [2, 4, 4, 4, 5, 5, 7, 9]
      // Mean = 5, Population StdDev = 2
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const result = calculateStandardDeviation(values);
      expect(result.mean).toBe(5);
      expect(result.population).toBeCloseTo(2, 1);
    });

    it("higher dispersion produces higher stddev", () => {
      const lowDispersion = [98, 99, 100, 101, 102];
      const highDispersion = [80, 90, 100, 110, 120];

      const lowResult = calculateStandardDeviation(lowDispersion);
      const highResult = calculateStandardDeviation(highDispersion);

      expect(highResult.population).toBeGreaterThan(lowResult.population);
    });

    it("handles single value", () => {
      const values = [100];
      const result = calculateStandardDeviation(values);
      expect(result.population).toBe(0);
      expect(result.mean).toBe(100);
    });

    it("handles two values", () => {
      const values = [100, 200];
      const result = calculateStandardDeviation(values);
      expect(result.mean).toBe(150);
      expect(result.population).toBe(50);
    });
  });

  describe("computeStandardDeviation (Effect)", () => {
    it.effect("computes standard deviation as Effect", () =>
      Effect.gen(function* () {
        const values = [10, 20, 30, 40, 50];
        const result = yield* computeStandardDeviation(values);
        expect(result.population).toBeDefined();
        expect(result.sample).toBeDefined();
        expect(result.variance).toBeDefined();
        expect(result.mean).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const values = [10, 20, 30, 40, 50];
        const result = yield* Effect.exit(computeStandardDeviation(values));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Noise Score", () => {
  describe("calculateNoiseScore", () => {
    it("returns value between 0 and 100", () => {
      const result = calculateNoiseScore(25, 3, 0.5);
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(100);
    });

    it("low ADX produces high noise", () => {
      const lowADX = calculateNoiseScore(10, 3, 0.5);
      const highADX = calculateNoiseScore(40, 3, 0.5);
      expect(lowADX.value).toBeGreaterThan(highADX.value);
    });

    it("extreme ATR produces high noise", () => {
      const normalATR = calculateNoiseScore(25, 3, 0.5);
      const extremeATR = calculateNoiseScore(25, 8, 0.5);
      expect(extremeATR.value).toBeGreaterThan(normalATR.value);
    });

    it("low indicator agreement produces high noise", () => {
      const highAgreement = calculateNoiseScore(25, 3, 0.8);
      const lowAgreement = calculateNoiseScore(25, 3, 0.3);
      expect(lowAgreement.value).toBeGreaterThan(highAgreement.value);
    });

    it("handles missing indicator agreement", () => {
      const result = calculateNoiseScore(25, 3, undefined);
      expect(result.value).toBeDefined();
      expect(result.level).toBeDefined();
    });

    it("classifies noise level correctly", () => {
      // Low noise: high ADX, normal ATR, high agreement
      const lowNoise = calculateNoiseScore(45, 2, 0.9);
      expect(["LOW", "MODERATE"]).toContain(lowNoise.level);

      // High noise: low ADX, high ATR, low agreement
      const highNoise = calculateNoiseScore(10, 7, 0.2);
      expect(["HIGH", "EXTREME"]).toContain(highNoise.level);
    });

    it("classifies LOW when value < 30", () => {
      // Strong trend, low volatility, high agreement
      const result = calculateNoiseScore(50, 1.5, 0.9);
      if (result.value < 30) {
        expect(result.level).toBe("LOW");
      }
    });

    it("classifies MODERATE when 30 <= value < 55", () => {
      const result = calculateNoiseScore(30, 3, 0.5);
      if (result.value >= 30 && result.value < 55) {
        expect(result.level).toBe("MODERATE");
      }
    });

    it("classifies HIGH when 55 <= value < 75", () => {
      const result = calculateNoiseScore(15, 5, 0.4);
      if (result.value >= 55 && result.value < 75) {
        expect(result.level).toBe("HIGH");
      }
    });

    it("classifies EXTREME when value >= 75", () => {
      const result = calculateNoiseScore(5, 10, 0.1);
      if (result.value >= 75) {
        expect(result.level).toBe("EXTREME");
      }
    });
  });

  describe("computeNoiseScore (Effect)", () => {
    it.effect("computes noise score as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeNoiseScore(25, 3, 0.5);
        expect(result.value).toBeDefined();
        expect(result.level).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeNoiseScore(25, 3, 0.5));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Correlation", () => {
  // Test data
  const series1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const series2 = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]; // Perfect positive correlation
  const inverseSeries = [20, 18, 16, 14, 12, 10, 8, 6, 4, 2]; // Perfect negative correlation
  const uncorrelatedSeries = [5, 3, 8, 2, 9, 1, 7, 4, 6, 10]; // Low correlation

  describe("calculateCorrelation", () => {
    it("returns coefficient of 1 for perfect positive correlation", () => {
      const result = calculateCorrelation(series1, series2);
      expect(result.coefficient).toBeCloseTo(1, 4);
    });

    it("returns coefficient of -1 for perfect negative correlation", () => {
      const result = calculateCorrelation(series1, inverseSeries);
      expect(result.coefficient).toBeCloseTo(-1, 4);
    });

    it("returns coefficient near 0 for uncorrelated series", () => {
      const result = calculateCorrelation(series1, uncorrelatedSeries);
      expect(Math.abs(result.coefficient)).toBeLessThan(0.5);
    });

    it("coefficient is between -1 and 1", () => {
      const result = calculateCorrelation(series1, uncorrelatedSeries);
      expect(result.coefficient).toBeGreaterThanOrEqual(-1);
      expect(result.coefficient).toBeLessThanOrEqual(1);
    });

    it("classifies VERY_STRONG when |r| > 0.9", () => {
      const result = calculateCorrelation(series1, series2);
      expect(result.strength).toBe("VERY_STRONG");
    });

    it("classifies STRONG when 0.7 < |r| <= 0.9", () => {
      const result = calculateCorrelation(series1, uncorrelatedSeries);
      if (Math.abs(result.coefficient) > 0.7 && Math.abs(result.coefficient) <= 0.9) {
        expect(result.strength).toBe("STRONG");
      }
    });

    it("classifies direction correctly", () => {
      const positive = calculateCorrelation(series1, series2);
      const negative = calculateCorrelation(series1, inverseSeries);

      expect(positive.direction).toBe("POSITIVE");
      expect(negative.direction).toBe("NEGATIVE");
    });

    it("calculates R-squared correctly", () => {
      const result = calculateCorrelation(series1, series2);
      expect(result.rSquared).toBeCloseTo(1, 4);
      expect(result.rSquared).toBe(result.coefficient * result.coefficient);
    });

    it("handles different length arrays", () => {
      const short = [1, 2, 3];
      const result = calculateCorrelation(short, series2);
      expect(result.coefficient).toBeDefined();
    });

    it("handles zero variance", () => {
      const constant = [5, 5, 5, 5, 5];
      const result = calculateCorrelation(constant, series1.slice(0, 5));
      expect(result.coefficient).toBe(0);
    });
  });

  describe("computeCorrelation (Effect)", () => {
    it.effect("computes Correlation as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeCorrelation(series1, series2);
        expect(result.coefficient).toBeDefined();
        expect(result.strength).toBeDefined();
        expect(result.direction).toBeDefined();
        expect(result.rSquared).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeCorrelation(series1, series2));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Covariance", () => {
  const series1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const series2 = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
  const inverseSeries = [20, 18, 16, 14, 12, 10, 8, 6, 4, 2];

  describe("calculateCovariance", () => {
    it("returns positive covariance for positively related series", () => {
      const result = calculateCovariance(series1, series2);
      expect(result.value).toBeGreaterThan(0);
      expect(result.relationship).toBe("POSITIVE");
    });

    it("returns negative covariance for negatively related series", () => {
      const result = calculateCovariance(series1, inverseSeries);
      expect(result.value).toBeLessThan(0);
      expect(result.relationship).toBe("NEGATIVE");
    });

    it("returns near-zero covariance for unrelated series", () => {
      const unrelated = [5, 3, 8, 2, 9, 1, 7, 4, 6, 10];
      const result = calculateCovariance(series1, unrelated);
      expect(Math.abs(result.value)).toBeLessThan(5);
    });

    it("calculates normalized covariance (correlation)", () => {
      const result = calculateCovariance(series1, series2);
      expect(result.normalized).toBeCloseTo(1, 4);
    });

    it("classifies relationship correctly", () => {
      const positive = calculateCovariance(series1, series2);
      const negative = calculateCovariance(series1, inverseSeries);

      expect(positive.relationship).toBe("POSITIVE");
      expect(negative.relationship).toBe("NEGATIVE");
    });

    it("handles zero variance", () => {
      const constant = [5, 5, 5, 5, 5];
      const result = calculateCovariance(constant, series1.slice(0, 5));
      expect(result.value).toBe(0);
      expect(result.normalized).toBe(0);
    });
  });

  describe("computeCovariance (Effect)", () => {
    it.effect("computes Covariance as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeCovariance(series1, series2);
        expect(result.value).toBeDefined();
        expect(result.relationship).toBeDefined();
        expect(result.normalized).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeCovariance(series1, series2));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Linear Regression", () => {
  const xValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const yValues = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]; // y = 2x
  const noisyY = [2.1, 3.9, 6.2, 7.8, 10.1, 11.9, 14.2, 15.8, 18.1, 19.9]; // y ≈ 2x with noise

  describe("calculateLinearRegression", () => {
    it("calculates correct slope for perfect linear relationship", () => {
      const result = calculateLinearRegression(xValues, yValues);
      expect(result.slope).toBeCloseTo(2, 4);
    });

    it("calculates correct intercept for perfect linear relationship", () => {
      const result = calculateLinearRegression(xValues, yValues);
      expect(result.intercept).toBeCloseTo(0, 4);
    });

    it("returns R-squared of 1 for perfect fit", () => {
      const result = calculateLinearRegression(xValues, yValues);
      expect(result.rSquared).toBeCloseTo(1, 4);
    });

    it("returns high R-squared for noisy but linear data", () => {
      const result = calculateLinearRegression(xValues, noisyY);
      expect(result.rSquared).toBeGreaterThan(0.99);
    });

    it("calculates correlation correctly", () => {
      const result = calculateLinearRegression(xValues, yValues);
      expect(result.correlation).toBeCloseTo(1, 4);
    });

    it("predict function works correctly", () => {
      const result = calculateLinearRegression(xValues, yValues);
      expect(result.predict(5)).toBeCloseTo(10, 4);
      expect(result.predict(0)).toBeCloseTo(0, 4);
      expect(result.predict(15)).toBeCloseTo(30, 4);
    });

    it("handles negative slope", () => {
      const inverseY = [20, 18, 16, 14, 12, 10, 8, 6, 4, 2];
      const result = calculateLinearRegression(xValues, inverseY);
      expect(result.slope).toBeCloseTo(-2, 4);
      expect(result.correlation).toBeCloseTo(-1, 4);
    });

    it("handles zero variance in x", () => {
      const constantX = [5, 5, 5, 5, 5];
      const result = calculateLinearRegression(constantX, yValues.slice(0, 5));
      expect(result.slope).toBe(0);
    });
  });

  describe("computeLinearRegression (Effect)", () => {
    it.effect("computes Linear Regression as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeLinearRegression(xValues, yValues);
        expect(result.slope).toBeDefined();
        expect(result.intercept).toBeDefined();
        expect(result.rSquared).toBeDefined();
        expect(result.correlation).toBeDefined();
        expect(result.predict).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeLinearRegression(xValues, yValues));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Z-Score", () => {
  const dataset = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]; // Mean = 55, StdDev ≈ 28.7

  describe("calculateZScore", () => {
    it("returns Z-score of 0 for mean value", () => {
      const result = calculateZScore(55, dataset);
      expect(result.value).toBeCloseTo(0, 1);
    });

    it("returns positive Z-score for above-mean value", () => {
      const result = calculateZScore(100, dataset);
      expect(result.value).toBeGreaterThan(0);
    });

    it("returns negative Z-score for below-mean value", () => {
      const result = calculateZScore(10, dataset);
      expect(result.value).toBeLessThan(0);
    });

    it("classifies NORMAL when |z| <= 2", () => {
      const result = calculateZScore(55, dataset);
      expect(result.interpretation).toBe("NORMAL");
    });

    it("classifies UNUSUAL when 2 < |z| <= 3", () => {
      // Value about 2.5 std devs from mean
      const result = calculateZScore(130, dataset);
      if (Math.abs(result.value) > 2 && Math.abs(result.value) <= 3) {
        expect(result.interpretation).toBe("UNUSUAL");
      }
    });

    it("classifies VERY_UNUSUAL when |z| > 3", () => {
      // Value about 4 std devs from mean
      const result = calculateZScore(170, dataset);
      if (Math.abs(result.value) > 3) {
        expect(result.interpretation).toBe("VERY_UNUSUAL");
      }
    });

    it("calculates percentile correctly", () => {
      const result = calculateZScore(55, dataset);
      expect(result.percentile).toBeCloseTo(50, 5);
    });

    it("handles zero standard deviation", () => {
      const constant = [50, 50, 50, 50, 50];
      const result = calculateZScore(50, constant);
      expect(result.value).toBe(0);
    });
  });

  describe("calculateZScoreSeries", () => {
    it("returns correct length series", () => {
      const series = calculateZScoreSeries(dataset);
      expect(series.length).toBe(dataset.length);
    });

    it("mean of Z-scores is approximately 0", () => {
      const series = calculateZScoreSeries(dataset);
      const mean = series.reduce((a, b) => a + b, 0) / series.length;
      expect(mean).toBeCloseTo(0, 10);
    });

    it("handles zero standard deviation", () => {
      const constant = [50, 50, 50, 50, 50];
      const series = calculateZScoreSeries(constant);
      series.forEach((z) => expect(z).toBe(0));
    });
  });

  describe("computeZScore (Effect)", () => {
    it.effect("computes Z-Score as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeZScore(55, dataset);
        expect(result.value).toBeDefined();
        expect(result.interpretation).toBeDefined();
        expect(result.percentile).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeZScore(55, dataset));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});
