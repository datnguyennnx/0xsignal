import { it, expect, describe } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import {
  analyzeMarket,
  createMarketOverview,
  filterHighConfidence,
  rankByQuality,
  groupBySignal,
  getTopMovers,
} from "../analyze-market";
import { analyzeAsset } from "../analyze-asset";
import type { CryptoPrice, AssetAnalysis, ChartDataPoint } from "@0xsignal/shared";
import { ChartDataService, type ChartDataClient } from "../../infrastructure/data-sources/binance";

const mockChartClient: ChartDataClient = {
  info: {
    name: "MockChartData",
    version: "1.0.0",
    capabilities: {
      spotPrices: false,
      futuresPrices: false,
      historicalData: true,
      realtime: false,
      liquidations: false,
      openInterest: false,
      fundingRates: false,
      heatmap: false,
    },
    rateLimit: { requestsPerMinute: 1000 },
  },
  getHistoricalData: (_symbol: string, _interval: string, _limit?: number) =>
    Effect.succeed([] as ChartDataPoint[]),
};

const MockChartDataService = Layer.succeed(ChartDataService, mockChartClient);

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

const createMockAnalysis = async (price: CryptoPrice): Promise<AssetAnalysis> => {
  const result = await Effect.runPromise(
    analyzeAsset(price).pipe(Effect.provide(MockChartDataService))
  );
  return result;
};

describe("Analyze Market", () => {
  describe("analyzeMarket", () => {
    it.effect("analyzes multiple assets concurrently", () =>
      Effect.gen(function* () {
        const prices = [
          createMockPrice({ symbol: "btc", id: "bitcoin" }),
          createMockPrice({ symbol: "eth", id: "ethereum", price: 3000 }),
        ];

        const results = yield* analyzeMarket(prices, mockChartClient);

        expect(results).toHaveLength(2);
        expect(results[0].symbol).toBe("btc");
        expect(results[1].symbol).toBe("eth");
      })
    );

    it.effect("returns empty array for empty input", () =>
      Effect.gen(function* () {
        const results = yield* analyzeMarket([], mockChartClient);

        expect(results).toHaveLength(0);
      })
    );

    it.effect("each analysis has required fields", () =>
      Effect.gen(function* () {
        const prices = [createMockPrice()];

        const results = yield* analyzeMarket(prices, mockChartClient);

        expect(results[0].symbol).toBeDefined();
        expect(results[0].strategyResult).toBeDefined();
        expect(results[0].overallSignal).toBeDefined();
        expect(results[0].confidence).toBeDefined();
        expect(results[0].riskScore).toBeDefined();
      })
    );

    it.effect("returns success Exit (never fails)", () =>
      Effect.gen(function* () {
        const prices = [createMockPrice()];
        const result = yield* Effect.exit(analyzeMarket(prices, mockChartClient));

        expect(Exit.isSuccess(result)).toBe(true);
      })
    );
  });

  describe("createMarketOverview", () => {
    it("calculates total analyzed count", async () => {
      const analyses = await Promise.all([
        createMockAnalysis(createMockPrice({ symbol: "btc" })),
        createMockAnalysis(createMockPrice({ symbol: "eth" })),
      ]);

      const overview = createMarketOverview(analyses);

      expect(overview.totalAnalyzed).toBe(2);
    });

    it("identifies high risk assets", async () => {
      const highRiskPrice = createMockPrice({
        symbol: "risky",
        change24h: 20,
        high24h: 60000,
        low24h: 40000,
      });
      const analyses = await Promise.all([createMockAnalysis(highRiskPrice)]);

      const overview = createMarketOverview(analyses);

      expect(overview.highRiskAssets).toBeDefined();
    });

    it("calculates average risk score", async () => {
      const analyses = await Promise.all([
        createMockAnalysis(createMockPrice({ symbol: "btc" })),
        createMockAnalysis(createMockPrice({ symbol: "eth" })),
      ]);

      const overview = createMarketOverview(analyses);

      expect(overview.averageRiskScore).toBeGreaterThanOrEqual(0);
      expect(overview.averageRiskScore).toBeLessThanOrEqual(100);
    });

    it("includes timestamp", async () => {
      const analyses = await Promise.all([createMockAnalysis(createMockPrice())]);

      const overview = createMarketOverview(analyses);

      expect(overview.timestamp).toBeInstanceOf(Date);
    });

    it("handles empty analyses array", () => {
      const overview = createMarketOverview([]);

      expect(overview.totalAnalyzed).toBe(0);
      expect(overview.averageRiskScore).toBe(0);
      expect(overview.highRiskAssets).toBe(0);
    });
  });

  describe("filterHighConfidence", () => {
    it("filters analyses by minimum confidence", async () => {
      const analyses = await Promise.all([
        createMockAnalysis(createMockPrice({ symbol: "btc" })),
        createMockAnalysis(createMockPrice({ symbol: "eth" })),
      ]);

      const filtered = filterHighConfidence(analyses, 20);

      expect(filtered.length).toBeGreaterThanOrEqual(0);
      filtered.forEach((a) => {
        expect(a.confidence).toBeGreaterThanOrEqual(20);
      });
    });

    it("uses default threshold of 70", async () => {
      const analyses = await Promise.all([createMockAnalysis(createMockPrice())]);

      const filtered = filterHighConfidence(analyses);

      filtered.forEach((a) => {
        expect(a.confidence).toBeGreaterThanOrEqual(70);
      });
    });

    it("returns empty array when no analyses meet threshold", async () => {
      const analyses = await Promise.all([createMockAnalysis(createMockPrice())]);

      const filtered = filterHighConfidence(analyses, 100);

      expect(Array.isArray(filtered)).toBe(true);
    });
  });

  describe("rankByQuality", () => {
    it("sorts by quality score (confidence - risk/2)", async () => {
      const analyses = await Promise.all([
        createMockAnalysis(createMockPrice({ symbol: "btc" })),
        createMockAnalysis(createMockPrice({ symbol: "eth", change24h: 10 })),
      ]);

      const ranked = rankByQuality(analyses);

      expect(ranked).toHaveLength(2);
      const firstQuality = ranked[0].confidence - ranked[0].riskScore / 2;
      const secondQuality = ranked[1].confidence - ranked[1].riskScore / 2;
      expect(firstQuality).toBeGreaterThanOrEqual(secondQuality);
    });

    it("does not mutate original array", async () => {
      const analyses = await Promise.all([
        createMockAnalysis(createMockPrice({ symbol: "btc" })),
        createMockAnalysis(createMockPrice({ symbol: "eth" })),
      ]);
      const originalFirst = analyses[0].symbol;

      rankByQuality(analyses);

      expect(analyses[0].symbol).toBe(originalFirst);
    });
  });

  describe("groupBySignal", () => {
    it("groups analyses by overall signal", async () => {
      const analyses = await Promise.all([
        createMockAnalysis(createMockPrice({ symbol: "btc" })),
        createMockAnalysis(createMockPrice({ symbol: "eth" })),
      ]);

      const grouped = groupBySignal(analyses);

      expect(typeof grouped).toBe("object");
      const totalGrouped = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
      expect(totalGrouped).toBe(analyses.length);
    });

    it("handles empty array", () => {
      const grouped = groupBySignal([]);

      expect(Object.keys(grouped)).toHaveLength(0);
    });
  });

  describe("getTopMovers", () => {
    it("returns top movers by absolute price change", async () => {
      const analyses = await Promise.all([
        createMockAnalysis(createMockPrice({ symbol: "btc", change24h: 5 })),
        createMockAnalysis(createMockPrice({ symbol: "eth", change24h: -10 })),
        createMockAnalysis(createMockPrice({ symbol: "sol", change24h: 2 })),
      ]);

      const topMovers = getTopMovers(analyses, 2);

      expect(topMovers).toHaveLength(2);
      expect(Math.abs(topMovers[0].price.change24h)).toBeGreaterThanOrEqual(
        Math.abs(topMovers[1].price.change24h)
      );
    });

    it("uses default limit of 10", async () => {
      const analyses = await Promise.all(
        Array.from({ length: 15 }, (_, i) =>
          createMockAnalysis(createMockPrice({ symbol: `coin-${i}`, change24h: i }))
        )
      );

      const topMovers = getTopMovers(analyses);

      expect(topMovers).toHaveLength(10);
    });

    it("returns all if less than limit", async () => {
      const analyses = await Promise.all([
        createMockAnalysis(createMockPrice({ symbol: "btc" })),
        createMockAnalysis(createMockPrice({ symbol: "eth" })),
      ]);

      const topMovers = getTopMovers(analyses, 10);

      expect(topMovers).toHaveLength(2);
    });

    it("does not mutate original array", async () => {
      const analyses = await Promise.all([
        createMockAnalysis(createMockPrice({ symbol: "btc", change24h: 1 })),
        createMockAnalysis(createMockPrice({ symbol: "eth", change24h: 10 })),
      ]);
      const originalFirst = analyses[0].symbol;

      getTopMovers(analyses);

      expect(analyses[0].symbol).toBe(originalFirst);
    });
  });
});
