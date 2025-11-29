/** Buyback Domain Tests */

import { expect, describe, it } from "vitest";
import type { ProtocolBuyback, BuybackSignal } from "@0xsignal/shared";
import {
  classifyStrength,
  calcBuybackRate,
  createBuybackSignal,
  createCategoryStats,
  createBuybackOverview,
  buildPriceMap,
  computeBuybackSignals,
} from "../index";

// Mock protocol factory
const createMockProtocol = (overrides: Partial<ProtocolBuyback> = {}): ProtocolBuyback => ({
  protocol: "test-protocol",
  symbol: "TEST",
  geckoId: "test-token",
  revenue24h: 100000,
  revenue7d: 700000,
  revenue30d: 3000000,
  fees24h: 100000,
  fees7d: 700000,
  fees30d: 3000000,
  category: "DEX",
  chains: ["ethereum"],
  logo: "https://example.com/logo.png",
  url: "https://example.com",
  ...overrides,
});

// Mock buyback signal factory
const createMockSignal = (overrides: Partial<BuybackSignal> = {}): BuybackSignal => ({
  protocol: "test-protocol",
  symbol: "TEST",
  geckoId: "test-token",
  marketCap: 100000000,
  price: 10,
  revenue24h: 100000,
  revenue7d: 700000,
  revenue30d: 3000000,
  buybackRate24h: 0.1,
  buybackRate7d: 0.7,
  buybackRate30d: 3,
  annualizedBuybackRate: 36,
  category: "DEX",
  chains: ["ethereum"],
  logo: "https://example.com/logo.png",
  url: "https://example.com",
  signal: "VERY_HIGH",
  timestamp: new Date(),
  revenueToMcap: 0.36,
  annualizedRevenue: 36000000,
  impliedPE: 2.78,
  revenueGrowth7d: 0,
  ...overrides,
});

describe("Buyback Domain", () => {
  describe("classifyStrength", () => {
    it("returns NONE for rate <= 0", () => {
      expect(classifyStrength(0)).toBe("NONE");
      expect(classifyStrength(-1)).toBe("NONE");
    });

    it("returns LOW for rate < 1", () => {
      expect(classifyStrength(0.5)).toBe("LOW");
      expect(classifyStrength(0.99)).toBe("LOW");
    });

    it("returns MODERATE for rate >= 1 and < 5", () => {
      expect(classifyStrength(1)).toBe("MODERATE");
      expect(classifyStrength(4.99)).toBe("MODERATE");
    });

    it("returns HIGH for rate >= 5 and < 15", () => {
      expect(classifyStrength(5)).toBe("HIGH");
      expect(classifyStrength(14.99)).toBe("HIGH");
    });

    it("returns VERY_HIGH for rate >= 15", () => {
      expect(classifyStrength(15)).toBe("VERY_HIGH");
      expect(classifyStrength(100)).toBe("VERY_HIGH");
    });
  });

  describe("calcBuybackRate", () => {
    it("calculates correct buyback rate percentage", () => {
      const rate = calcBuybackRate(1000000, 100000000);
      expect(rate).toBe(1); // 1%
    });

    it("returns 0 for zero market cap", () => {
      const rate = calcBuybackRate(1000000, 0);
      expect(rate).toBe(0);
    });

    it("handles large numbers correctly", () => {
      const rate = calcBuybackRate(10000000000, 1000000000000);
      expect(rate).toBe(1);
    });
  });

  describe("createBuybackSignal", () => {
    it("creates valid buyback signal from protocol data", () => {
      const protocol = createMockProtocol();
      const signal = createBuybackSignal(protocol, 100000000, 10);

      expect(signal.protocol).toBe("test-protocol");
      expect(signal.symbol).toBe("TEST");
      expect(signal.marketCap).toBe(100000000);
      expect(signal.price).toBe(10);
    });

    it("calculates buyback rates correctly", () => {
      const protocol = createMockProtocol({
        revenue24h: 100000,
        revenue7d: 700000,
        revenue30d: 3000000,
      });
      const signal = createBuybackSignal(protocol, 100000000, 10);

      expect(signal.buybackRate24h).toBeCloseTo(0.1, 5); // 100000/100000000 * 100
      expect(signal.buybackRate7d).toBeCloseTo(0.7, 5);
      expect(signal.buybackRate30d).toBeCloseTo(3, 5);
    });

    it("calculates annualized buyback rate", () => {
      const protocol = createMockProtocol({ revenue30d: 3000000 });
      const signal = createBuybackSignal(protocol, 100000000, 10);

      expect(signal.annualizedBuybackRate).toBe(36); // 3 * 12
    });

    it("calculates annualized revenue", () => {
      const protocol = createMockProtocol({ revenue30d: 3000000 });
      const signal = createBuybackSignal(protocol, 100000000, 10);

      expect(signal.annualizedRevenue).toBe(36000000); // 3000000 * 12
    });

    it("calculates implied PE ratio", () => {
      const protocol = createMockProtocol({ revenue30d: 3000000 });
      const signal = createBuybackSignal(protocol, 100000000, 10);

      // 100000000 / 36000000 ≈ 2.78
      expect(signal.impliedPE).toBeCloseTo(2.78, 1);
    });

    it("calculates revenue growth 7d", () => {
      const protocol = createMockProtocol({
        revenue24h: 150000,
        revenue7d: 700000, // avg daily = 100000
      });
      const signal = createBuybackSignal(protocol, 100000000, 10);

      // (150000 - 100000) / 100000 * 100 = 50%
      expect(signal.revenueGrowth7d).toBe(50);
    });

    it("classifies signal strength correctly", () => {
      const highRevenueProtocol = createMockProtocol({ revenue30d: 15000000 });
      const signal = createBuybackSignal(highRevenueProtocol, 100000000, 10);

      expect(signal.signal).toBe("VERY_HIGH");
    });

    it("includes timestamp", () => {
      const protocol = createMockProtocol();
      const signal = createBuybackSignal(protocol, 100000000, 10);

      expect(signal.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("createCategoryStats", () => {
    it("groups signals by category", () => {
      const signals = [
        createMockSignal({ category: "DEX", revenue24h: 100000 }),
        createMockSignal({ category: "DEX", revenue24h: 200000 }),
        createMockSignal({ category: "Lending", revenue24h: 150000 }),
      ];

      const stats = createCategoryStats(signals);

      expect(stats["DEX"]).toBeDefined();
      expect(stats["Lending"]).toBeDefined();
      expect(stats["DEX"].protocolCount).toBe(2);
      expect(stats["Lending"].protocolCount).toBe(1);
    });

    it("calculates total revenue per category", () => {
      const signals = [
        createMockSignal({ category: "DEX", revenue24h: 100000 }),
        createMockSignal({ category: "DEX", revenue24h: 200000 }),
      ];

      const stats = createCategoryStats(signals);

      expect(stats["DEX"].totalRevenue24h).toBe(300000);
    });

    it("calculates average buyback rate per category", () => {
      const signals = [
        createMockSignal({ category: "DEX", annualizedBuybackRate: 10 }),
        createMockSignal({ category: "DEX", annualizedBuybackRate: 20 }),
      ];

      const stats = createCategoryStats(signals);

      expect(stats["DEX"].averageBuybackRate).toBe(15);
    });

    it("handles empty signals array", () => {
      const stats = createCategoryStats([]);

      expect(Object.keys(stats)).toHaveLength(0);
    });
  });

  describe("createBuybackOverview", () => {
    it("calculates total protocols", () => {
      const signals = [createMockSignal(), createMockSignal(), createMockSignal()];

      const overview = createBuybackOverview(signals);

      expect(overview.totalProtocols).toBe(3);
    });

    it("calculates total revenue 24h", () => {
      const signals = [
        createMockSignal({ revenue24h: 100000 }),
        createMockSignal({ revenue24h: 200000 }),
      ];

      const overview = createBuybackOverview(signals);

      expect(overview.totalRevenue24h).toBe(300000);
    });

    it("calculates total revenue 7d", () => {
      const signals = [
        createMockSignal({ revenue7d: 700000 }),
        createMockSignal({ revenue7d: 1400000 }),
      ];

      const overview = createBuybackOverview(signals);

      expect(overview.totalRevenue7d).toBe(2100000);
    });

    it("calculates average buyback rate", () => {
      const signals = [
        createMockSignal({ annualizedBuybackRate: 10 }),
        createMockSignal({ annualizedBuybackRate: 20 }),
      ];

      const overview = createBuybackOverview(signals);

      expect(overview.averageBuybackRate).toBe(15);
    });

    it("includes top 10 buyback protocols", () => {
      const signals = Array.from({ length: 15 }, (_, i) =>
        createMockSignal({ protocol: `protocol-${i}` })
      );

      const overview = createBuybackOverview(signals);

      expect(overview.topBuybackProtocols).toHaveLength(10);
    });

    it("includes category stats", () => {
      const signals = [
        createMockSignal({ category: "DEX" }),
        createMockSignal({ category: "Lending" }),
      ];

      const overview = createBuybackOverview(signals);

      expect(overview.byCategory["DEX"]).toBeDefined();
      expect(overview.byCategory["Lending"]).toBeDefined();
    });

    it("includes timestamp", () => {
      const overview = createBuybackOverview([createMockSignal()]);

      expect(overview.timestamp).toBeInstanceOf(Date);
    });

    it("handles empty signals array", () => {
      const overview = createBuybackOverview([]);

      expect(overview.totalProtocols).toBe(0);
      expect(overview.totalRevenue24h).toBe(0);
      expect(overview.averageBuybackRate).toBe(0);
    });
  });

  describe("buildPriceMap", () => {
    it("builds map from crypto data", () => {
      const cryptos = [
        { id: "bitcoin", marketCap: 1000000000000, price: 50000 },
        { id: "ethereum", marketCap: 500000000000, price: 3000 },
      ];

      const map = buildPriceMap(cryptos);

      expect(map.get("bitcoin")).toEqual({ marketCap: 1000000000000, price: 50000 });
      expect(map.get("ethereum")).toEqual({ marketCap: 500000000000, price: 3000 });
    });

    it("filters out entries without id", () => {
      const cryptos = [
        { id: "bitcoin", marketCap: 1000000000000, price: 50000 },
        { id: undefined, marketCap: 500000000000, price: 3000 },
      ];

      const map = buildPriceMap(cryptos as any);

      expect(map.size).toBe(1);
      expect(map.has("bitcoin")).toBe(true);
    });

    it("filters out entries with zero market cap", () => {
      const cryptos = [
        { id: "bitcoin", marketCap: 1000000000000, price: 50000 },
        { id: "dead-coin", marketCap: 0, price: 0 },
      ];

      const map = buildPriceMap(cryptos);

      expect(map.size).toBe(1);
      expect(map.has("dead-coin")).toBe(false);
    });

    it("handles empty array", () => {
      const map = buildPriceMap([]);

      expect(map.size).toBe(0);
    });
  });

  describe("computeBuybackSignals", () => {
    it("computes signals from protocols and price map", () => {
      const protocols = [
        createMockProtocol({ geckoId: "test-1", revenue30d: 5000000 }),
        createMockProtocol({ geckoId: "test-2", revenue30d: 3000000 }),
      ];
      const priceMap = new Map([
        ["test-1", { marketCap: 100000000, price: 10 }],
        ["test-2", { marketCap: 100000000, price: 5 }],
      ]);

      const signals = computeBuybackSignals(protocols, priceMap, 10);

      expect(signals.length).toBe(2);
    });

    it("filters out protocols without geckoId", () => {
      const protocols = [
        createMockProtocol({ geckoId: "test-1" }),
        createMockProtocol({ geckoId: null }),
      ];
      const priceMap = new Map([["test-1", { marketCap: 100000000, price: 10 }]]);

      const signals = computeBuybackSignals(protocols, priceMap, 10);

      expect(signals.length).toBe(1);
    });

    it("filters out protocols not in price map", () => {
      const protocols = [
        createMockProtocol({ geckoId: "test-1" }),
        createMockProtocol({ geckoId: "unknown" }),
      ];
      const priceMap = new Map([["test-1", { marketCap: 100000000, price: 10 }]]);

      const signals = computeBuybackSignals(protocols, priceMap, 10);

      expect(signals.length).toBe(1);
    });

    it("filters out signals with zero buyback rate", () => {
      const protocols = [
        createMockProtocol({ geckoId: "test-1", revenue30d: 3000000 }),
        createMockProtocol({ geckoId: "test-2", revenue30d: 0 }),
      ];
      const priceMap = new Map([
        ["test-1", { marketCap: 100000000, price: 10 }],
        ["test-2", { marketCap: 100000000, price: 5 }],
      ]);

      const signals = computeBuybackSignals(protocols, priceMap, 10);

      expect(signals.length).toBe(1);
    });

    it("sorts by annualized buyback rate descending", () => {
      const protocols = [
        createMockProtocol({ geckoId: "low", revenue30d: 1000000 }),
        createMockProtocol({ geckoId: "high", revenue30d: 10000000 }),
        createMockProtocol({ geckoId: "mid", revenue30d: 5000000 }),
      ];
      const priceMap = new Map([
        ["low", { marketCap: 100000000, price: 10 }],
        ["high", { marketCap: 100000000, price: 10 }],
        ["mid", { marketCap: 100000000, price: 10 }],
      ]);

      const signals = computeBuybackSignals(protocols, priceMap, 10);

      expect(signals[0].geckoId).toBe("high");
      expect(signals[1].geckoId).toBe("mid");
      expect(signals[2].geckoId).toBe("low");
    });

    it("respects limit parameter", () => {
      const protocols = Array.from({ length: 20 }, (_, i) =>
        createMockProtocol({ geckoId: `test-${i}`, revenue30d: 3000000 })
      );
      const priceMap = new Map(
        Array.from({ length: 20 }, (_, i) => [`test-${i}`, { marketCap: 100000000, price: 10 }])
      );

      const signals = computeBuybackSignals(protocols, priceMap, 5);

      expect(signals.length).toBe(5);
    });
  });
});
