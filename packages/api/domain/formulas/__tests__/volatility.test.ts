import { it, expect, describe } from "@effect/vitest";
import { Effect, Exit } from "effect";

import { computeATRFromHistory } from "../volatility/atr";
import {
  calculateBollingerBands,
  computeBollingerBands,
  detectBollingerSqueeze,
} from "../volatility/bollinger-bands";
import {
  calculateDonchianChannels,
  calculateDonchianChannelsSeries,
  computeDonchianChannels,
} from "../volatility/donchian-channels";
import {
  calculateGarmanKlassVolatility,
  calculateGarmanKlassVolatilitySeries,
  computeGarmanKlassVolatility,
} from "../volatility/garman-klass";
import {
  calculateHistoricalVolatility,
  calculateHistoricalVolatilitySeries,
  computeHistoricalVolatility,
} from "../volatility/historical-volatility";
import {
  calculateParkinsonVolatility,
  calculateParkinsonVolatilitySeries,
  computeParkinsonVolatility,
} from "../volatility/parkinson";
import type { CryptoPrice } from "@0xsignal/shared";

const uptrend = [100, 102, 105, 108, 112, 115, 118, 122, 125, 128, 132, 135, 138, 142, 145, 148];
const highs = uptrend.map((p) => p * 1.02);
const lows = uptrend.map((p) => p * 0.98);
const closes = uptrend;

const volatileHighs = [100, 110, 95, 115, 90, 120, 85, 125, 80, 130, 75, 135, 70, 140, 65, 145];
const volatileLows = [90, 85, 80, 85, 75, 90, 70, 95, 65, 100, 60, 105, 55, 110, 50, 115];
const volatileCloses = [95, 100, 88, 105, 82, 110, 78, 115, 72, 120, 68, 125, 62, 130, 58, 135];

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
  describe("computeATRFromHistory", () => {
    it.effect("returns positive ATR value", () =>
      Effect.gen(function* () {
        const result = yield* computeATRFromHistory(highs, lows, closes);
        expect(result.atr).toBeGreaterThan(0);
      })
    );

    it.effect("returns normalized ATR as percentage", () =>
      Effect.gen(function* () {
        const result = yield* computeATRFromHistory(highs, lows, closes);
        expect(result.normalizedATR).toBeGreaterThan(0);
        expect(result.normalizedATR).toBeLessThan(100);
      })
    );

    it.effect("classifies volatility level correctly", () =>
      Effect.gen(function* () {
        const lowVolResult = yield* computeATRFromHistory(highs, lows, closes);
        expect(["LOW", "MEDIUM"]).toContain(lowVolResult.volatility);

        const highVolResult = yield* computeATRFromHistory(
          volatileHighs,
          volatileLows,
          volatileCloses
        );
        expect(["HIGH", "MEDIUM"]).toContain(highVolResult.volatility);
      })
    );

    it.effect("higher volatility produces higher ATR", () =>
      Effect.gen(function* () {
        const lowVolATR = yield* computeATRFromHistory(highs, lows, closes);
        const highVolATR = yield* computeATRFromHistory(
          volatileHighs,
          volatileLows,
          volatileCloses
        );
        expect(highVolATR.atr).toBeGreaterThan(lowVolATR.atr);
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeATRFromHistory(highs, lows, closes));
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
      expect(result.upperBand).toBeCloseTo(55000, 0);
      expect(result.middleBand).toBeCloseTo(50000, 0);
      expect(result.lowerBand).toBeCloseTo(45000, 0);
      expect(result.percentB).toBeCloseTo(0.5, 2);
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
    it("includes symbol in result", () => {
      const price = createMockPrice({ symbol: "eth" });
      const bb = calculateBollingerBands(price.price, price.high24h, price.low24h);
      const result = detectBollingerSqueeze(price, bb);
      expect(result.symbol).toBe("eth");
    });
  });
});

describe("Donchian Channels", () => {
  const dcHighs = Array.from({ length: 25 }, (_, i) => 102 + i * 2);
  const dcLows = Array.from({ length: 25 }, (_, i) => 98 + i * 2);
  const dcCloses = Array.from({ length: 25 }, (_, i) => 100 + i * 2);

  describe("calculateDonchianChannels", () => {
    it("returns upper, middle, lower channels", () => {
      const result = calculateDonchianChannels(dcHighs, dcLows, dcCloses, 20);
      expect(result.upper).toBeDefined();
      expect(result.middle).toBeDefined();
      expect(result.lower).toBeDefined();
    });

    it("upper > middle > lower", () => {
      const result = calculateDonchianChannels(dcHighs, dcLows, dcCloses, 20);
      expect(result.upper).toBeGreaterThan(result.middle);
      expect(result.middle).toBeGreaterThan(result.lower);
    });

    it("upper is highest high of period", () => {
      const result = calculateDonchianChannels(dcHighs, dcLows, dcCloses, 20);
      const recentHighs = dcHighs.slice(-20);
      expect(result.upper).toBe(Math.max(...recentHighs));
    });

    it("lower is lowest low of period", () => {
      const result = calculateDonchianChannels(dcHighs, dcLows, dcCloses, 20);
      const recentLows = dcLows.slice(-20);
      expect(result.lower).toBe(Math.min(...recentLows));
    });
  });

  describe("calculateDonchianChannelsSeries", () => {
    it("returns correct length series", () => {
      const series = calculateDonchianChannelsSeries(dcHighs, dcLows, 20);
      expect(series.upper.length).toBe(dcHighs.length - 20 + 1);
    });
  });

  describe("computeDonchianChannels (Effect)", () => {
    it.effect("computes Donchian Channels as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeDonchianChannels(dcHighs, dcLows, dcCloses, 20);
        expect(result.upper).toBeDefined();
        expect(result.middle).toBeDefined();
        expect(result.lower).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeDonchianChannels(dcHighs, dcLows, dcCloses, 20));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Garman-Klass Volatility", () => {
  const gkOpens = Array.from({ length: 35 }, (_, i) => 100 + i);
  const gkHighs = Array.from({ length: 35 }, (_, i) => 102 + i);
  const gkLows = Array.from({ length: 35 }, (_, i) => 98 + i);
  const gkCloses = Array.from({ length: 35 }, (_, i) => 101 + i);
  const volHighs = Array.from({ length: 35 }, (_, i) => 100 + i + Math.sin(i) * 10);
  const volLows = Array.from({ length: 35 }, (_, i) => 100 + i - Math.sin(i) * 10);

  describe("calculateGarmanKlassVolatility", () => {
    it("returns volatility value", () => {
      const result = calculateGarmanKlassVolatility(gkOpens, gkHighs, gkLows, gkCloses, 30);
      expect(result.value).toBeDefined();
      expect(result.value).toBeGreaterThanOrEqual(0);
    });

    it("returns daily volatility", () => {
      const result = calculateGarmanKlassVolatility(gkOpens, gkHighs, gkLows, gkCloses, 30);
      expect(result.dailyVol).toBeDefined();
      expect(result.dailyVol).toBeGreaterThanOrEqual(0);
    });

    it("classifies volatility level", () => {
      const result = calculateGarmanKlassVolatility(gkOpens, gkHighs, gkLows, gkCloses, 30);
      expect(["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"]).toContain(result.level);
    });

    it("higher price swings produce higher volatility", () => {
      const lowVol = calculateGarmanKlassVolatility(gkOpens, gkHighs, gkLows, gkCloses, 30);
      const highVol = calculateGarmanKlassVolatility(gkOpens, volHighs, volLows, gkCloses, 30);
      expect(highVol.value).toBeGreaterThan(lowVol.value);
    });
  });

  describe("calculateGarmanKlassVolatilitySeries", () => {
    it("returns correct length series", () => {
      const series = calculateGarmanKlassVolatilitySeries(gkOpens, gkHighs, gkLows, gkCloses, 30);
      expect(series.length).toBe(gkOpens.length - 30 + 1);
    });
  });

  describe("computeGarmanKlassVolatility (Effect)", () => {
    it.effect("computes Garman-Klass Volatility as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeGarmanKlassVolatility(gkOpens, gkHighs, gkLows, gkCloses, 30);
        expect(result.value).toBeDefined();
        expect(result.dailyVol).toBeDefined();
        expect(result.level).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(
          computeGarmanKlassVolatility(gkOpens, gkHighs, gkLows, gkCloses, 30)
        );
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Historical Volatility", () => {
  const hvCloses = Array.from({ length: 35 }, (_, i) => 100 + i);
  const hvVolatileCloses = Array.from({ length: 35 }, (_, i) => 100 + i + Math.sin(i) * 10);

  describe("calculateHistoricalVolatility", () => {
    it("returns volatility value", () => {
      const result = calculateHistoricalVolatility(hvCloses, 30);
      expect(result.value).toBeDefined();
      expect(result.value).toBeGreaterThanOrEqual(0);
    });

    it("returns daily volatility", () => {
      const result = calculateHistoricalVolatility(hvCloses, 30);
      expect(result.dailyVol).toBeDefined();
      expect(result.dailyVol).toBeGreaterThanOrEqual(0);
    });

    it("classifies volatility level", () => {
      const result = calculateHistoricalVolatility(hvCloses, 30);
      expect(["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"]).toContain(result.level);
    });

    it("higher price swings produce higher volatility", () => {
      const lowVol = calculateHistoricalVolatility(hvCloses, 30);
      const highVol = calculateHistoricalVolatility(hvVolatileCloses, 30);
      expect(highVol.value).toBeGreaterThan(lowVol.value);
    });
  });

  describe("calculateHistoricalVolatilitySeries", () => {
    it("returns correct length series", () => {
      const series = calculateHistoricalVolatilitySeries(hvCloses, 30);
      expect(series.length).toBe(hvCloses.length - 1 - 30 + 1);
    });
  });

  describe("computeHistoricalVolatility (Effect)", () => {
    it.effect("computes Historical Volatility as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeHistoricalVolatility(hvCloses, 30);
        expect(result.value).toBeDefined();
        expect(result.dailyVol).toBeDefined();
        expect(result.level).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeHistoricalVolatility(hvCloses, 30));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});

describe("Parkinson Volatility", () => {
  const pkHighs = Array.from({ length: 35 }, (_, i) => 102 + i);
  const pkLows = Array.from({ length: 35 }, (_, i) => 98 + i);
  const pkVolHighs = Array.from({ length: 35 }, (_, i) => 110 + i);
  const pkVolLows = Array.from({ length: 35 }, (_, i) => 90 + i);

  describe("calculateParkinsonVolatility", () => {
    it("returns volatility value", () => {
      const result = calculateParkinsonVolatility(pkHighs, pkLows, 30);
      expect(result.value).toBeDefined();
      expect(result.value).toBeGreaterThanOrEqual(0);
    });

    it("returns daily volatility", () => {
      const result = calculateParkinsonVolatility(pkHighs, pkLows, 30);
      expect(result.dailyVol).toBeDefined();
      expect(result.dailyVol).toBeGreaterThanOrEqual(0);
    });

    it("classifies volatility level", () => {
      const result = calculateParkinsonVolatility(pkHighs, pkLows, 30);
      expect(["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"]).toContain(result.level);
    });

    it("wider high-low range produces higher volatility", () => {
      const lowVol = calculateParkinsonVolatility(pkHighs, pkLows, 30);
      const highVol = calculateParkinsonVolatility(pkVolHighs, pkVolLows, 30);
      expect(highVol.value).toBeGreaterThan(lowVol.value);
    });
  });

  describe("calculateParkinsonVolatilitySeries", () => {
    it("returns correct length series", () => {
      const series = calculateParkinsonVolatilitySeries(pkHighs, pkLows, 30);
      expect(series.length).toBe(pkHighs.length - 30 + 1);
    });
  });

  describe("computeParkinsonVolatility (Effect)", () => {
    it.effect("computes Parkinson Volatility as Effect", () =>
      Effect.gen(function* () {
        const result = yield* computeParkinsonVolatility(pkHighs, pkLows, 30);
        expect(result.value).toBeDefined();
        expect(result.dailyVol).toBeDefined();
        expect(result.level).toBeDefined();
      })
    );

    it.effect("returns success Exit", () =>
      Effect.gen(function* () {
        const result = yield* Effect.exit(computeParkinsonVolatility(pkHighs, pkLows, 30));
        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});
