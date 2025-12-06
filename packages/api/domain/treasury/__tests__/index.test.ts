/** Treasury Domain Tests */

import { describe, it, expect } from "vitest";
import type { TreasuryHolding, TreasuryTx, CoinId } from "../types";
import {
  toHolding,
  toTransaction,
  calcNetChange,
  buildSummary,
  toChartPoints,
  getAccumulationSignal,
} from "../index";

// Mock raw company data factory
const createRawCompany = (
  overrides: Partial<{
    name: string;
    symbol: string;
    country: string;
    total_holdings: number;
    total_entry_value_usd: number;
    total_current_value_usd: number;
    percentage_of_total_supply: number;
  }> = {}
) => ({
  name: "MicroStrategy",
  symbol: "MSTR",
  country: "US",
  total_holdings: 174530,
  total_entry_value_usd: 5000000000,
  total_current_value_usd: 15000000000,
  percentage_of_total_supply: 0.83,
  ...overrides,
});

// Mock raw transaction factory
const createRawTx = (
  overrides: Partial<{
    date: number;
    coin_id: string;
    type: string;
    holding_net_change: number;
    transaction_value_usd: number;
    holding_balance: number;
    average_entry_value_usd: number;
    source_url: string | null;
  }> = {}
) => ({
  date: Date.now() - 86400000, // 1 day ago
  coin_id: "bitcoin",
  type: "buy",
  holding_net_change: 5000,
  transaction_value_usd: 450000000,
  holding_balance: 179530,
  average_entry_value_usd: 30000,
  source_url: "https://example.com/tx",
  ...overrides,
});

// Mock TreasuryTx factory
const createMockTx = (overrides: Partial<TreasuryTx> = {}): TreasuryTx => ({
  date: new Date(Date.now() - 86400000),
  coinId: "bitcoin" as CoinId,
  type: "buy",
  holdingNetChange: 5000,
  txValueUsd: 450000000,
  holdingBalance: 179530,
  avgEntryUsd: 30000,
  sourceUrl: null,
  ...overrides,
});

// Mock TreasuryHolding factory
const createMockHolding = (overrides: Partial<TreasuryHolding> = {}): TreasuryHolding => ({
  entityId: "mstr" as any,
  entityName: "MicroStrategy",
  symbol: "MSTR",
  country: "US",
  totalHoldings: 174530,
  entryValueUsd: 5000000000,
  currentValueUsd: 15000000000,
  percentOfSupply: 0.83,
  unrealizedPnlUsd: 10000000000,
  unrealizedPnlPercent: 200,
  ...overrides,
});

describe("Treasury Domain", () => {
  describe("toHolding", () => {
    it("transforms raw API data to domain TreasuryHolding", () => {
      const raw = createRawCompany();
      const holding = toHolding(raw);

      expect(holding.entityId).toBe("mstr");
      expect(holding.entityName).toBe("MicroStrategy");
      expect(holding.symbol).toBe("MSTR");
      expect(holding.country).toBe("US");
      expect(holding.totalHoldings).toBe(174530);
      expect(holding.entryValueUsd).toBe(5000000000);
      expect(holding.currentValueUsd).toBe(15000000000);
      expect(holding.percentOfSupply).toBe(0.83);
    });

    it("calculates unrealized PnL correctly", () => {
      const raw = createRawCompany({
        total_entry_value_usd: 1000000,
        total_current_value_usd: 1500000,
      });
      const holding = toHolding(raw);

      expect(holding.unrealizedPnlUsd).toBe(500000);
      expect(holding.unrealizedPnlPercent).toBe(50);
    });

    it("handles zero entry value gracefully", () => {
      const raw = createRawCompany({
        total_entry_value_usd: 0,
        total_current_value_usd: 1000000,
      });
      const holding = toHolding(raw);

      expect(holding.unrealizedPnlUsd).toBe(1000000);
      expect(holding.unrealizedPnlPercent).toBe(0);
    });

    it("handles negative PnL (loss scenario)", () => {
      const raw = createRawCompany({
        total_entry_value_usd: 2000000,
        total_current_value_usd: 1000000,
      });
      const holding = toHolding(raw);

      expect(holding.unrealizedPnlUsd).toBe(-1000000);
      expect(holding.unrealizedPnlPercent).toBe(-50);
    });
  });

  describe("toTransaction", () => {
    it("transforms raw API data to domain TreasuryTx", () => {
      const raw = createRawTx();
      const tx = toTransaction(raw);

      expect(tx.coinId).toBe("bitcoin");
      expect(tx.type).toBe("buy");
      expect(tx.holdingNetChange).toBe(5000);
      expect(tx.txValueUsd).toBe(450000000);
      expect(tx.holdingBalance).toBe(179530);
      expect(tx.avgEntryUsd).toBe(30000);
      expect(tx.sourceUrl).toBe("https://example.com/tx");
      expect(tx.date).toBeInstanceOf(Date);
    });

    it("handles null source URL", () => {
      const raw = createRawTx({ source_url: null });
      const tx = toTransaction(raw);

      expect(tx.sourceUrl).toBeNull();
    });
  });

  describe("calcNetChange", () => {
    it("calculates net change from buy transactions", () => {
      const txs = [
        createMockTx({ type: "buy", holdingNetChange: 5000, holdingBalance: 100000 }),
        createMockTx({ type: "buy", holdingNetChange: 3000, holdingBalance: 95000 }),
      ];

      const result = calcNetChange(txs, 30);

      expect(result.netChange).toBe(8000);
    });

    it("calculates net change from sell transactions (subtracts)", () => {
      const txs = [createMockTx({ type: "sell", holdingNetChange: -2000, holdingBalance: 100000 })];

      const result = calcNetChange(txs, 30);

      expect(result.netChange).toBe(-2000);
    });

    it("handles mixed buy/sell transactions", () => {
      const txs = [
        createMockTx({ type: "buy", holdingNetChange: 10000, holdingBalance: 110000 }),
        createMockTx({ type: "sell", holdingNetChange: -3000, holdingBalance: 100000 }),
      ];

      const result = calcNetChange(txs, 30);

      expect(result.netChange).toBe(7000); // 10000 - 3000
    });

    it("filters transactions outside time window", () => {
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

      const txs = [
        createMockTx({ date: recentDate, type: "buy", holdingNetChange: 5000 }),
        createMockTx({ date: oldDate, type: "buy", holdingNetChange: 10000 }),
      ];

      const result = calcNetChange(txs, 30);

      expect(result.netChange).toBe(5000); // Only recent tx counted
    });

    it("returns zero for empty transactions", () => {
      const result = calcNetChange([], 30);

      expect(result.netChange).toBe(0);
      expect(result.netChangePercent).toBe(0);
    });

    it("calculates percentage change correctly", () => {
      const txs = [createMockTx({ type: "buy", holdingNetChange: 10000, holdingBalance: 110000 })];

      const result = calcNetChange(txs, 30);

      // Starting balance was 100000 (110000 - 10000), net change 10000 = 10%
      expect(result.netChangePercent).toBeCloseTo(10, 1);
    });
  });

  describe("buildSummary", () => {
    it("builds complete TreasurySummary", () => {
      const holdings = [
        createMockHolding({ entityName: "Company A", totalHoldings: 100000 }),
        createMockHolding({ entityName: "Company B", totalHoldings: 50000 }),
      ];
      const transactions = [createMockTx({ type: "buy", holdingNetChange: 5000 })];

      const summary = buildSummary(
        "bitcoin" as CoinId,
        holdings,
        transactions,
        150000,
        13500000000,
        0.71
      );

      expect(summary.coinId).toBe("bitcoin");
      expect(summary.totalHoldings).toBe(150000);
      expect(summary.totalValueUsd).toBe(13500000000);
      expect(summary.marketCapDominance).toBe(0.71);
      expect(summary.entityCount).toBe(2);
      expect(summary.lastUpdated).toBeInstanceOf(Date);
    });

    it("sorts top holders by holdings descending", () => {
      const holdings = [
        createMockHolding({ entityName: "Small", totalHoldings: 1000 }),
        createMockHolding({ entityName: "Large", totalHoldings: 100000 }),
        createMockHolding({ entityName: "Medium", totalHoldings: 50000 }),
      ];

      const summary = buildSummary("bitcoin" as CoinId, holdings, [], 151000, 0, 0);

      expect(summary.topHolders[0].entityName).toBe("Large");
      expect(summary.topHolders[1].entityName).toBe("Medium");
      expect(summary.topHolders[2].entityName).toBe("Small");
    });

    it("limits top holders to 10", () => {
      const holdings = Array.from({ length: 15 }, (_, i) =>
        createMockHolding({ entityName: `Company ${i}`, totalHoldings: 1000 * (15 - i) })
      );

      const summary = buildSummary("bitcoin" as CoinId, holdings, [], 0, 0, 0);

      expect(summary.topHolders).toHaveLength(10);
    });

    it("limits recent transactions to 20", () => {
      const transactions = Array.from({ length: 30 }, () => createMockTx());

      const summary = buildSummary("bitcoin" as CoinId, [], transactions, 0, 0, 0);

      expect(summary.recentTransactions).toHaveLength(20);
    });
  });

  describe("toChartPoints", () => {
    it("transforms historical data to chart points", () => {
      const holdings: [number, number][] = [
        [1700000000000, 100000],
        [1700100000000, 105000],
      ];
      const values: [number, number][] = [
        [1700000000000, 9000000000],
        [1700100000000, 9800000000],
      ];

      const points = toChartPoints(holdings, values);

      expect(points).toHaveLength(2);
      expect(points[0].timestamp).toBe(1700000000000);
      expect(points[0].holdings).toBe(100000);
      expect(points[0].valueUsd).toBe(9000000000);
    });

    it("handles missing value data with zero", () => {
      const holdings: [number, number][] = [[1700000000000, 100000]];
      const values: [number, number][] = []; // Empty values

      const points = toChartPoints(holdings, values);

      expect(points[0].valueUsd).toBe(0);
    });
  });

  describe("getAccumulationSignal", () => {
    it("returns strong_buy for >= 5% net change", () => {
      expect(getAccumulationSignal(5)).toBe("strong_buy");
      expect(getAccumulationSignal(10)).toBe("strong_buy");
    });

    it("returns buy for >= 1% and < 5%", () => {
      expect(getAccumulationSignal(1)).toBe("buy");
      expect(getAccumulationSignal(4.9)).toBe("buy");
    });

    it("returns neutral for between -1% and 1%", () => {
      expect(getAccumulationSignal(0)).toBe("neutral");
      expect(getAccumulationSignal(0.5)).toBe("neutral");
      expect(getAccumulationSignal(-0.5)).toBe("neutral");
    });

    it("returns sell for <= -1% and > -5%", () => {
      expect(getAccumulationSignal(-1)).toBe("sell");
      expect(getAccumulationSignal(-4.9)).toBe("sell");
    });

    it("returns strong_sell for <= -5%", () => {
      expect(getAccumulationSignal(-5)).toBe("strong_sell");
      expect(getAccumulationSignal(-10)).toBe("strong_sell");
    });
  });
});
