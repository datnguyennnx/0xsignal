import { it, expect, describe } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { findEntry, findEntryWithIndicators } from "../find-entries";
import type { CryptoPrice } from "@0xsignal/shared";
import type { IndicatorOutput } from "../../domain/analysis/indicator-types";

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

const createMockIndicators = (overrides: Partial<IndicatorOutput> = {}): IndicatorOutput => ({
  rsi: { value: 50, signal: "NEUTRAL", avgGain: 1, avgLoss: 1 },
  macd: { macd: 0.5, signal: 0.3, histogram: 0.2, crossover: "NONE" },
  adx: { value: 30, plusDI: 28, minusDI: 22, trend: "MODERATE" },
  atr: { value: 500, normalized: 2.5, volatility: "MEDIUM" },
  isValid: true,
  dataPoints: 168,
  ...overrides,
});

describe("Find Entries", () => {
  describe("findEntry (legacy)", () => {
    it.effect("returns NEUTRAL for stablecoins", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ symbol: "usdt", price: 1.0, change24h: 0.01 });
        const result = yield* findEntry(price);

        expect(result.direction).toBe("NEUTRAL");
        expect(result.confidence).toBe(0);
        expect(result.isOptimalEntry).toBe(false);
        expect(result.recommendation).toContain("stablecoin");
      })
    );

    it.effect("returns NEUTRAL for USDC (stablecoin)", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ symbol: "usdc", price: 1.0, change24h: 0.02 });
        const result = yield* findEntry(price);

        expect(result.direction).toBe("NEUTRAL");
        expect(result.confidence).toBe(0);
      })
    );

    it.effect("returns NEUTRAL for DAI (stablecoin)", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ symbol: "dai", price: 1.0, change24h: -0.01 });
        const result = yield* findEntry(price);

        expect(result.direction).toBe("NEUTRAL");
        expect(result.confidence).toBe(0);
      })
    );

    it.effect("returns success Exit (never fails)", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const result = yield* Effect.exit(findEntry(price));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });

  describe("findEntryWithIndicators", () => {
    it.effect("returns valid EntrySignal structure", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(result.direction).toBeDefined();
        expect(typeof result.isOptimalEntry).toBe("boolean");
        expect(result.strength).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
        expect(result.indicators).toBeDefined();
        expect(typeof result.entryPrice).toBe("number");
        expect(typeof result.targetPrice).toBe("number");
        expect(typeof result.stopLoss).toBe("number");
        expect(typeof result.recommendation).toBe("string");
        expect(result.indicatorSummary).toBeDefined();
        expect(result.dataSource).toBe("HISTORICAL_OHLCV");
      })
    );

    it.effect("returns valid direction values", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "HOLD", 50);

        const validDirections = ["LONG", "SHORT", "NEUTRAL"];
        expect(validDirections).toContain(result.direction);
      })
    );

    it.effect("returns valid strength levels", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        const validStrengths = ["WEAK", "MODERATE", "STRONG", "VERY_STRONG"];
        expect(validStrengths).toContain(result.strength);
      })
    );

    it.effect("sets entry price to current price", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ price: 45000 });
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(result.entryPrice).toBe(45000);
      })
    );

    it.effect("returns NEUTRAL for low volume assets", () =>
      Effect.gen(function* () {
        const price = createMockPrice({ symbol: "xyz", volume24h: 50000 });
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(result.direction).toBe("NEUTRAL");
        expect(result.recommendation).toContain("insufficient");
      })
    );

    it.effect("returns LONG direction for BUY signal", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(result.direction).toBe("LONG");
      })
    );

    it.effect("returns LONG direction for STRONG_BUY signal", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "STRONG_BUY", 70);

        expect(result.direction).toBe("LONG");
      })
    );

    it.effect("returns SHORT direction for SELL signal", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "SELL", 60);

        expect(result.direction).toBe("SHORT");
      })
    );

    it.effect("returns SHORT direction for STRONG_SELL signal", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "STRONG_SELL", 70);

        expect(result.direction).toBe("SHORT");
      })
    );

    it.effect("calculates target above entry for LONG", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(result.direction).toBe("LONG");
        expect(result.targetPrice).toBeGreaterThan(result.entryPrice);
        expect(result.stopLoss).toBeLessThan(result.entryPrice);
      })
    );

    it.effect("calculates target below entry for SHORT", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "SELL", 60);

        expect(result.direction).toBe("SHORT");
        expect(result.targetPrice).toBeLessThan(result.entryPrice);
        expect(result.stopLoss).toBeGreaterThan(result.entryPrice);
      })
    );

    it.effect("calculates positive risk/reward ratio", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(result.riskRewardRatio).toBeGreaterThan(0);
      })
    );

    it.effect("returns valid leverage values", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(result.suggestedLeverage).toBeGreaterThanOrEqual(1);
        expect(result.maxLeverage).toBeGreaterThanOrEqual(result.suggestedLeverage);
      })
    );

    it.effect("includes indicator summary with RSI", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators({
          rsi: { value: 45, signal: "NEUTRAL", avgGain: 1, avgLoss: 1 },
        });
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(result.indicatorSummary.rsi).toBeDefined();
        expect(result.indicatorSummary.rsi.value).toBe(45);
      })
    );

    it.effect("includes indicator summary with MACD", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(result.indicatorSummary.macd).toBeDefined();
        expect(["BULLISH", "BEARISH", "NEUTRAL"]).toContain(result.indicatorSummary.macd.trend);
      })
    );

    it.effect("includes indicator summary with ADX", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(result.indicatorSummary.adx).toBeDefined();
        expect(result.indicatorSummary.adx.value).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes indicator summary with ATR", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(result.indicatorSummary.atr).toBeDefined();
        expect(result.indicatorSummary.atr.value).toBeGreaterThanOrEqual(0);
      })
    );

    it.effect("includes all entry indicator fields", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* findEntryWithIndicators(price, indicators, "BUY", 60);

        expect(typeof result.indicators.trendReversal).toBe("boolean");
        expect(typeof result.indicators.volumeIncrease).toBe("boolean");
        expect(typeof result.indicators.momentumBuilding).toBe("boolean");
        expect(typeof result.indicators.divergence).toBe("boolean");
      })
    );

    it.effect("returns success Exit (never fails)", () =>
      Effect.gen(function* () {
        const price = createMockPrice();
        const indicators = createMockIndicators();
        const result = yield* Effect.exit(findEntryWithIndicators(price, indicators, "BUY", 60));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });
});
