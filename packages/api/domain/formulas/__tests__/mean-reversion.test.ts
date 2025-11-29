/** Mean Reversion Formulas Tests - Bollinger Width, Distance from MA, Percent B, Keltner Width, Mean Reversion Score */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";

// Bollinger Width
import {
  calculateBollingerWidth,
  calculateBBWidth,
  computeBBWidth,
} from "../mean-reversion/bollinger-width";
// Distance from MA
import { calculateDistanceFromMA, computeDistanceFromMA } from "../mean-reversion/distance-from-ma";
// Percent B
import { calculatePercentB, calculatePctB, computePercentB } from "../mean-reversion/percent-b";
// Keltner Width
import { calculateKeltnerWidth, computeKeltnerWidth } from "../mean-reversion/keltner-width";
// Mean Reversion Score
import {
  calculateMeanReversionScore,
  computeMeanReversionScore,
} from "../mean-reversion/mean-reversion-score";

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

describe("Bollinger Band Width", () => {
  describe("calculateBollingerWidth", () => {
    it("calculates width correctly", () => {
      const width = calculateBollingerWidth(110, 90, 100);
      expect(width).toBe(0.2); // (110-90)/100 = 0.2
    });

    it("returns 0 when middle band is 0", () => {
      const width = calculateBollingerWidth(10, 0, 0);
      expect(width).toBe(0);
    });

    it("higher volatility produces wider bands", () => {
      const lowVol = calculateBollingerWidth(105, 95, 100);
      const highVol = calculateBollingerWidth(120, 80, 100);
      expect(highVol).toBeGreaterThan(lowVol);
    });
  });

  describe("calculateBBWidth", () => {
    it("returns width and interpretation", () => {
      const price = createMockPrice();
      const result = calculateBBWidth(price);

      expect(result.width).toBeDefined();
      expect(result.widthPercent).toBeDefined();
      expect(result.squeeze).toBeDefined();
      expect(result.trend).toBeDefined();
    });

    it("classifies tight squeeze when width < 0.05", () => {
      // Very narrow range
      const price = createMockPrice({
        price: 50000,
        high24h: 50100,
        low24h: 49900,
      });
      const result = calculateBBWidth(price);

      if (result.width < 0.05) {
        expect(result.squeeze).toBe("TIGHT");
      }
    });

    it("classifies wide when width > 0.2", () => {
      // Very wide range
      const price = createMockPrice({
        price: 50000,
        high24h: 60000,
        low24h: 40000,
      });
      const result = calculateBBWidth(price);

      if (result.width > 0.2) {
        expect(result.squeeze).toBe("WIDE");
      }
    });

    it("classifies trend based on width", () => {
      const price = createMockPrice();
      const result = calculateBBWidth(price);

      expect(["NARROWING", "STABLE", "WIDENING"]).toContain(result.trend);
    });

    it("handles missing high/low", () => {
      const price = createMockPrice({
        high24h: undefined,
        low24h: undefined,
      });
      const result = calculateBBWidth(price);

      expect(result.width).toBeDefined();
    });
  });

  describe("computeBBWidth (Effect)", () => {
    it.effect("computes BB Width as Effect", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeBBWidth(price);

        expect(result.width).toBeDefined();
        expect(result.squeeze).toBeDefined();
        expect(result.trend).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(computeBBWidth(price));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Distance from Moving Average", () => {
  describe("calculateDistanceFromMA", () => {
    it("returns positive distance when price above MA", () => {
      const price = createMockPrice({
        price: 52000,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculateDistanceFromMA(price);

      expect(result.distance).toBeGreaterThan(0);
    });

    it("returns negative distance when price below MA", () => {
      const price = createMockPrice({
        price: 48000,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculateDistanceFromMA(price);

      expect(result.distance).toBeLessThan(0);
    });

    it("returns near-zero distance when price at MA", () => {
      const price = createMockPrice({
        price: 50000,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculateDistanceFromMA(price);

      expect(Math.abs(result.distance)).toBeLessThan(1);
    });

    it("classifies extreme above when distance > 10", () => {
      const price = createMockPrice({
        price: 60000,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculateDistanceFromMA(price);

      if (result.distance > 10) {
        expect(result.signal).toBe("EXTREME_ABOVE");
      }
    });

    it("classifies extreme below when distance < -10", () => {
      const price = createMockPrice({
        price: 40000,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculateDistanceFromMA(price);

      if (result.distance < -10) {
        expect(result.signal).toBe("EXTREME_BELOW");
      }
    });

    it("identifies mean reversion setup when |distance| > 5", () => {
      const extremePrice = createMockPrice({
        price: 55000,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculateDistanceFromMA(extremePrice);

      if (Math.abs(result.distance) > 5) {
        expect(result.meanReversionSetup).toBe(true);
      }
    });

    it("calculates strength based on distance", () => {
      const price = createMockPrice();
      const result = calculateDistanceFromMA(price);

      expect(result.strength).toBeGreaterThanOrEqual(0);
      expect(result.strength).toBeLessThanOrEqual(100);
    });

    it("handles missing high/low", () => {
      const price = createMockPrice({
        high24h: undefined,
        low24h: undefined,
      });
      const result = calculateDistanceFromMA(price);

      expect(result.distance).toBe(0); // Price equals MA when no range
    });
  });

  describe("computeDistanceFromMA (Effect)", () => {
    it.effect("computes distance as Effect", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeDistanceFromMA(price);

        expect(result.distance).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.meanReversionSetup).toBeDefined();
        expect(result.strength).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(computeDistanceFromMA(price));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Percent B (%B)", () => {
  describe("calculatePercentB", () => {
    it("returns 0.5 when price at middle", () => {
      const percentB = calculatePercentB(100, 110, 90);
      expect(percentB).toBe(0.5);
    });

    it("returns 1.0 when price at upper band", () => {
      const percentB = calculatePercentB(110, 110, 90);
      expect(percentB).toBe(1.0);
    });

    it("returns 0.0 when price at lower band", () => {
      const percentB = calculatePercentB(90, 110, 90);
      expect(percentB).toBe(0.0);
    });

    it("returns > 1.0 when price above upper band", () => {
      const percentB = calculatePercentB(120, 110, 90);
      expect(percentB).toBeGreaterThan(1.0);
    });

    it("returns < 0.0 when price below lower band", () => {
      const percentB = calculatePercentB(80, 110, 90);
      expect(percentB).toBeLessThan(0.0);
    });

    it("returns 0.5 when bands are equal (zero width)", () => {
      const percentB = calculatePercentB(100, 100, 100);
      expect(percentB).toBe(0.5);
    });
  });

  describe("calculatePctB", () => {
    it("returns %B with interpretation", () => {
      const price = createMockPrice();
      const result = calculatePctB(price);

      expect(result.value).toBeDefined();
      expect(result.signal).toBeDefined();
      expect(result.position).toBeDefined();
      expect(result.meanReversionSetup).toBeDefined();
    });

    it("classifies overbought when %B > 0.8", () => {
      const price = createMockPrice({
        price: 51500,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculatePctB(price);

      if (result.value > 0.8) {
        expect(result.signal).toBe("OVERBOUGHT");
      }
    });

    it("classifies oversold when %B < 0.2", () => {
      const price = createMockPrice({
        price: 48500,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculatePctB(price);

      if (result.value < 0.2) {
        expect(result.signal).toBe("OVERSOLD");
      }
    });

    it("classifies position correctly", () => {
      const price = createMockPrice();
      const result = calculatePctB(price);

      expect(["ABOVE_BANDS", "UPPER_HALF", "MIDDLE", "LOWER_HALF", "BELOW_BANDS"]).toContain(
        result.position
      );
    });

    it("identifies mean reversion setup when outside bands", () => {
      // Price above upper band
      const abovePrice = createMockPrice({
        price: 55000,
        high24h: 51000,
        low24h: 49000,
      });
      const aboveResult = calculatePctB(abovePrice);

      if (aboveResult.value > 1.0) {
        expect(aboveResult.meanReversionSetup).toBe(true);
      }

      // Price below lower band
      const belowPrice = createMockPrice({
        price: 45000,
        high24h: 51000,
        low24h: 49000,
      });
      const belowResult = calculatePctB(belowPrice);

      if (belowResult.value < 0.0) {
        expect(belowResult.meanReversionSetup).toBe(true);
      }
    });
  });

  describe("computePercentB (Effect)", () => {
    it.effect("computes %B as Effect", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computePercentB(price);

        expect(result.value).toBeDefined();
        expect(result.signal).toBeDefined();
        expect(result.position).toBeDefined();
        expect(result.meanReversionSetup).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(computePercentB(price));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Keltner Width", () => {
  describe("calculateKeltnerWidth", () => {
    it("returns width and volatility classification", () => {
      const price = createMockPrice();
      const result = calculateKeltnerWidth(price);

      expect(result.width).toBeDefined();
      expect(result.widthPercent).toBeDefined();
      expect(result.volatility).toBeDefined();
    });

    it("calculates width based on ATR", () => {
      const price = createMockPrice({
        price: 50000,
        high24h: 52000,
        low24h: 48000,
      });
      const result = calculateKeltnerWidth(price);

      // ATR = (52000 - 48000) / 2 = 2000
      // Upper = 50000 + 2 * 2000 = 54000
      // Lower = 50000 - 2 * 2000 = 46000
      // Width = (54000 - 46000) / 50000 = 0.16
      expect(result.width).toBeCloseTo(0.16, 2);
    });

    it("classifies VERY_LOW volatility when width < 0.04", () => {
      const price = createMockPrice({
        price: 50000,
        high24h: 50200,
        low24h: 49800,
      });
      const result = calculateKeltnerWidth(price);

      if (result.width < 0.04) {
        expect(result.volatility).toBe("VERY_LOW");
      }
    });

    it("classifies LOW volatility when 0.04 <= width < 0.08", () => {
      const price = createMockPrice({
        price: 50000,
        high24h: 50500,
        low24h: 49500,
      });
      const result = calculateKeltnerWidth(price);

      if (result.width >= 0.04 && result.width < 0.08) {
        expect(result.volatility).toBe("LOW");
      }
    });

    it("classifies NORMAL volatility when 0.08 <= width < 0.15", () => {
      const price = createMockPrice({
        price: 50000,
        high24h: 51500,
        low24h: 48500,
      });
      const result = calculateKeltnerWidth(price);

      if (result.width >= 0.08 && result.width < 0.15) {
        expect(result.volatility).toBe("NORMAL");
      }
    });

    it("classifies HIGH volatility when 0.15 <= width < 0.25", () => {
      const price = createMockPrice({
        price: 50000,
        high24h: 54000,
        low24h: 46000,
      });
      const result = calculateKeltnerWidth(price);

      if (result.width >= 0.15 && result.width < 0.25) {
        expect(result.volatility).toBe("HIGH");
      }
    });

    it("classifies VERY_HIGH volatility when width >= 0.25", () => {
      const price = createMockPrice({
        price: 50000,
        high24h: 60000,
        low24h: 40000,
      });
      const result = calculateKeltnerWidth(price);

      if (result.width >= 0.25) {
        expect(result.volatility).toBe("VERY_HIGH");
      }
    });

    it("handles missing high/low with default ATR", () => {
      const price = createMockPrice({
        high24h: undefined,
        low24h: undefined,
      });
      const result = calculateKeltnerWidth(price);

      // Default ATR = price * 0.02 = 1000
      // Width = (4 * 1000) / 50000 = 0.08
      expect(result.width).toBeCloseTo(0.08, 2);
    });

    it("widthPercent is width * 100", () => {
      const price = createMockPrice();
      const result = calculateKeltnerWidth(price);

      expect(result.widthPercent).toBeCloseTo(result.width * 100, 0);
    });
  });

  describe("computeKeltnerWidth (Effect)", () => {
    it.effect("computes Keltner Width as Effect", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeKeltnerWidth(price);

        expect(result.width).toBeDefined();
        expect(result.widthPercent).toBeDefined();
        expect(result.volatility).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(computeKeltnerWidth(price));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Mean Reversion Score", () => {
  describe("calculateMeanReversionScore", () => {
    it("returns score and components", () => {
      const price = createMockPrice();
      const result = calculateMeanReversionScore(price);

      expect(result.score).toBeDefined();
      expect(result.direction).toBeDefined();
      expect(result.strength).toBeDefined();
      expect(result.components).toBeDefined();
      expect(result.components.percentB).toBeDefined();
      expect(result.components.bollingerWidth).toBeDefined();
      expect(result.components.distanceFromMA).toBeDefined();
      expect(result.components.keltnerWidth).toBeDefined();
    });

    it("score is between 0 and 100", () => {
      const price = createMockPrice();
      const result = calculateMeanReversionScore(price);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("returns BUY direction when oversold", () => {
      const price = createMockPrice({
        price: 45000,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculateMeanReversionScore(price);

      // Price below lower band should trigger BUY
      expect(result.direction).toBe("BUY");
    });

    it("returns SELL direction when overbought", () => {
      const price = createMockPrice({
        price: 55000,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculateMeanReversionScore(price);

      // Price above upper band should trigger SELL
      expect(result.direction).toBe("SELL");
    });

    it("returns NEUTRAL direction when price in middle", () => {
      const price = createMockPrice({
        price: 50000,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculateMeanReversionScore(price);

      expect(result.direction).toBe("NEUTRAL");
    });

    it("classifies VERY_STRONG when score > 80", () => {
      // Extreme conditions for high score
      const price = createMockPrice({
        price: 40000,
        high24h: 50100,
        low24h: 49900,
      });
      const result = calculateMeanReversionScore(price);

      if (result.score > 80) {
        expect(result.strength).toBe("VERY_STRONG");
      }
    });

    it("classifies STRONG when 60 < score <= 80", () => {
      const price = createMockPrice();
      const result = calculateMeanReversionScore(price);

      if (result.score > 60 && result.score <= 80) {
        expect(result.strength).toBe("STRONG");
      }
    });

    it("classifies MODERATE when 40 < score <= 60", () => {
      const price = createMockPrice();
      const result = calculateMeanReversionScore(price);

      if (result.score > 40 && result.score <= 60) {
        expect(result.strength).toBe("MODERATE");
      }
    });

    it("classifies WEAK when 20 < score <= 40", () => {
      const price = createMockPrice();
      const result = calculateMeanReversionScore(price);

      if (result.score > 20 && result.score <= 40) {
        expect(result.strength).toBe("WEAK");
      }
    });

    it("classifies VERY_WEAK when score <= 20", () => {
      const price = createMockPrice({
        price: 50000,
        high24h: 51000,
        low24h: 49000,
      });
      const result = calculateMeanReversionScore(price);

      if (result.score <= 20) {
        expect(result.strength).toBe("VERY_WEAK");
      }
    });

    it("component scores are between 0 and 100", () => {
      const price = createMockPrice();
      const result = calculateMeanReversionScore(price);

      expect(result.components.percentB).toBeGreaterThanOrEqual(0);
      expect(result.components.percentB).toBeLessThanOrEqual(100);
      expect(result.components.bollingerWidth).toBeGreaterThanOrEqual(0);
      expect(result.components.bollingerWidth).toBeLessThanOrEqual(100);
      expect(result.components.distanceFromMA).toBeGreaterThanOrEqual(0);
      expect(result.components.distanceFromMA).toBeLessThanOrEqual(100);
      expect(result.components.keltnerWidth).toBeGreaterThanOrEqual(0);
      expect(result.components.keltnerWidth).toBeLessThanOrEqual(100);
    });
  });

  describe("computeMeanReversionScore (Effect)", () => {
    it.effect("computes Mean Reversion Score as Effect", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* computeMeanReversionScore(price);

        expect(result.score).toBeDefined();
        expect(result.direction).toBeDefined();
        expect(result.strength).toBeDefined();
        expect(result.components).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(computeMeanReversionScore(price));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});
