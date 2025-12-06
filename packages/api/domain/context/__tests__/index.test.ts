/** Context Domain Tests */

import { describe, it, expect } from "vitest";
import type {
  RiskContext,
  TreasuryContext,
  LiquidationContext,
  DerivativesContext,
} from "@0xsignal/shared";
import {
  computeRiskContext,
  classifyLiquidationRisk,
  classifyDominantSide,
  classifyFundingBias,
  generateInsights,
} from "../index";

// Mock TreasuryContext factory
const createMockTreasury = (overrides: Partial<TreasuryContext> = {}): TreasuryContext => ({
  hasInstitutionalHoldings: true,
  totalHoldingsUsd: 50000000000,
  entityCount: 100,
  percentOfSupply: 2.5,
  netChange30d: 3.2,
  accumulationSignal: "buy",
  topHolders: [],
  ...overrides,
});

// Mock LiquidationContext factory
const createMockLiquidation = (
  overrides: Partial<LiquidationContext> = {}
): LiquidationContext => ({
  hasLiquidationData: true,
  nearbyLiquidationRisk: "MEDIUM",
  dominantSide: "LONG",
  liquidationRatio: 1.1,
  totalLiquidationUsd24h: 25000000,
  dangerZones: [],
  ...overrides,
});

// Mock DerivativesContext factory
const createMockDerivatives = (
  overrides: Partial<DerivativesContext> = {}
): DerivativesContext => ({
  openInterestUsd: 15000000000,
  oiChange24h: 5.2,
  fundingRate: 0.005,
  fundingBias: "NEUTRAL",
  ...overrides,
});

describe("Context Domain", () => {
  describe("computeRiskContext", () => {
    it("returns base risk when no external factors", () => {
      const result = computeRiskContext(50, null, null);

      expect(result.baseRisk).toBe(50);
      expect(result.finalRisk).toBe(50);
      expect(result.liquidationMultiplier).toBe(1.0);
      expect(result.treasuryMultiplier).toBe(1.0);
      expect(result.riskLevel).toBe("HIGH"); // 50 is >= 50, so HIGH
      expect(result.explanation).toBe("Standard risk assessment");
    });

    it("applies 1.3x multiplier for HIGH liquidation risk", () => {
      const liq = createMockLiquidation({ nearbyLiquidationRisk: "HIGH" });
      const result = computeRiskContext(50, liq, null);

      expect(result.liquidationMultiplier).toBe(1.3);
      expect(result.finalRisk).toBe(65); // 50 * 1.3 = 65
      expect(result.explanation).toContain("Critical: High liquidation clusters nearby");
    });

    it("applies 1.15x multiplier for MEDIUM liquidation risk", () => {
      const liq = createMockLiquidation({ nearbyLiquidationRisk: "MEDIUM" });
      const result = computeRiskContext(50, liq, null);

      expect(result.liquidationMultiplier).toBe(1.15);
      expect(result.finalRisk).toBe(57); // 50 * 1.15 = 57.5 (actually 57.49... due to float)
      expect(result.explanation).toContain("Moderate liquidation levels detected");
    });

    it("applies no multiplier for LOW liquidation risk", () => {
      const liq = createMockLiquidation({ nearbyLiquidationRisk: "LOW" });
      const result = computeRiskContext(50, liq, null);

      expect(result.liquidationMultiplier).toBe(1.0);
      expect(result.finalRisk).toBe(50);
    });

    it("applies 0.85x multiplier for institutional accumulation (buy)", () => {
      const treasury = createMockTreasury({ accumulationSignal: "buy" });
      const result = computeRiskContext(50, null, treasury);

      expect(result.treasuryMultiplier).toBe(0.85);
      expect(result.finalRisk).toBe(43); // 50 * 0.85 = 42.5, rounded
      expect(result.explanation).toContain("Institutional accumulation");
    });

    it("applies 0.85x multiplier for strong_buy", () => {
      const treasury = createMockTreasury({ accumulationSignal: "strong_buy" });
      const result = computeRiskContext(50, null, treasury);

      expect(result.treasuryMultiplier).toBe(0.85);
    });

    it("applies 1.1x multiplier for institutional distribution (sell)", () => {
      const treasury = createMockTreasury({ accumulationSignal: "sell" });
      const result = computeRiskContext(50, null, treasury);

      expect(result.treasuryMultiplier).toBe(1.1);
      expect(result.explanation).toContain("Institutional distribution");
    });

    it("enforces risk floor of 60 for HIGH liquidation risk", () => {
      const liq = createMockLiquidation({ nearbyLiquidationRisk: "HIGH" });
      // Base risk 20 * 1.3 = 26, but floor is 60
      const result = computeRiskContext(20, liq, null);

      expect(result.finalRisk).toBe(60);
      expect(result.riskLevel).toBe("HIGH");
    });

    it("enforces risk floor of 45 for institutional distribution", () => {
      const treasury = createMockTreasury({ accumulationSignal: "strong_sell" });
      // Base risk 30 * 1.1 = 33, but floor is 45
      const result = computeRiskContext(30, null, treasury);

      expect(result.finalRisk).toBe(45);
      expect(result.riskLevel).toBe("MEDIUM");
    });

    it("takes maximum of liquidation and distribution floors", () => {
      const liq = createMockLiquidation({ nearbyLiquidationRisk: "HIGH" });
      const treasury = createMockTreasury({ accumulationSignal: "sell" });
      // Floor from liquidation = 60, floor from distribution = 45
      // Max floor = 60
      const result = computeRiskContext(10, liq, treasury);

      expect(result.finalRisk).toBe(60);
    });

    it("combines liquidation and treasury multipliers", () => {
      const liq = createMockLiquidation({ nearbyLiquidationRisk: "MEDIUM" });
      const treasury = createMockTreasury({ accumulationSignal: "buy" });
      // 50 * 1.15 * 0.85 = 48.875
      const result = computeRiskContext(50, liq, treasury);

      expect(result.finalRisk).toBe(49);
      expect(result.explanation).toContain("Moderate liquidation levels detected");
      expect(result.explanation).toContain("Institutional accumulation");
    });

    it("caps final risk at 100", () => {
      const liq = createMockLiquidation({ nearbyLiquidationRisk: "HIGH" });
      const treasury = createMockTreasury({ accumulationSignal: "sell" });
      // 90 * 1.3 * 1.1 = 128.7, capped at 100
      const result = computeRiskContext(90, liq, treasury);

      expect(result.finalRisk).toBe(100);
      expect(result.riskLevel).toBe("EXTREME");
    });

    it("classifies risk levels correctly", () => {
      expect(computeRiskContext(20, null, null).riskLevel).toBe("LOW");
      expect(computeRiskContext(40, null, null).riskLevel).toBe("MEDIUM");
      expect(computeRiskContext(60, null, null).riskLevel).toBe("HIGH");
      expect(computeRiskContext(80, null, null).riskLevel).toBe("EXTREME");
    });

    it("ignores treasury without institutional holdings", () => {
      const treasury = createMockTreasury({
        hasInstitutionalHoldings: false,
        accumulationSignal: "strong_buy",
      });
      const result = computeRiskContext(50, null, treasury);

      expect(result.treasuryMultiplier).toBe(1.0);
    });

    it("ignores liquidation without data", () => {
      const liq = createMockLiquidation({
        hasLiquidationData: false,
        nearbyLiquidationRisk: "HIGH",
      });
      const result = computeRiskContext(50, liq, null);

      expect(result.liquidationMultiplier).toBe(1.0);
    });
  });

  describe("classifyLiquidationRisk", () => {
    it("returns HIGH for > $50M", () => {
      expect(classifyLiquidationRisk(50_000_001)).toBe("HIGH");
      expect(classifyLiquidationRisk(100_000_000)).toBe("HIGH");
    });

    it("returns MEDIUM for > $10M and <= $50M", () => {
      expect(classifyLiquidationRisk(10_000_001)).toBe("MEDIUM");
      expect(classifyLiquidationRisk(50_000_000)).toBe("MEDIUM");
    });

    it("returns LOW for <= $10M", () => {
      expect(classifyLiquidationRisk(10_000_000)).toBe("LOW");
      expect(classifyLiquidationRisk(5_000_000)).toBe("LOW");
      expect(classifyLiquidationRisk(0)).toBe("LOW");
    });
  });

  describe("classifyDominantSide", () => {
    it("returns LONG for ratio > 1.2", () => {
      expect(classifyDominantSide(1.21)).toBe("LONG");
      expect(classifyDominantSide(2.0)).toBe("LONG");
    });

    it("returns SHORT for ratio < 0.8", () => {
      expect(classifyDominantSide(0.79)).toBe("SHORT");
      expect(classifyDominantSide(0.5)).toBe("SHORT");
    });

    it("returns BALANCED for ratio between 0.8 and 1.2", () => {
      expect(classifyDominantSide(0.8)).toBe("BALANCED");
      expect(classifyDominantSide(1.0)).toBe("BALANCED");
      expect(classifyDominantSide(1.2)).toBe("BALANCED");
    });
  });

  describe("classifyFundingBias", () => {
    it("returns LONG_HEAVY for funding rate > 0.01%", () => {
      expect(classifyFundingBias(0.011)).toBe("LONG_HEAVY");
      expect(classifyFundingBias(0.05)).toBe("LONG_HEAVY");
    });

    it("returns SHORT_HEAVY for funding rate < -0.01%", () => {
      expect(classifyFundingBias(-0.011)).toBe("SHORT_HEAVY");
      expect(classifyFundingBias(-0.05)).toBe("SHORT_HEAVY");
    });

    it("returns NEUTRAL for funding rate between -0.01% and 0.01%", () => {
      expect(classifyFundingBias(0)).toBe("NEUTRAL");
      expect(classifyFundingBias(0.01)).toBe("NEUTRAL");
      expect(classifyFundingBias(-0.01)).toBe("NEUTRAL");
    });
  });

  describe("generateInsights", () => {
    it("generates insight for institutional accumulation", () => {
      const treasury = createMockTreasury({ netChange30d: 5.5 });
      const riskContext: RiskContext = {
        baseRisk: 50,
        liquidationMultiplier: 1,
        treasuryMultiplier: 1,
        finalRisk: 50,
        riskLevel: "MEDIUM",
        explanation: "",
      };

      const insights = generateInsights("HOLD", riskContext, treasury, null, null);

      expect(insights).toContain("Institutions accumulated 5.5% more in 30d");
    });

    it("does not generate insight for negative net change", () => {
      const treasury = createMockTreasury({ netChange30d: -2.0 });
      const riskContext: RiskContext = {
        baseRisk: 50,
        liquidationMultiplier: 1,
        treasuryMultiplier: 1,
        finalRisk: 50,
        riskLevel: "MEDIUM",
        explanation: "",
      };

      const insights = generateInsights("HOLD", riskContext, treasury, null, null);

      expect(insights.length).toBe(0);
    });

    it("generates insight for HIGH liquidation risk", () => {
      const liq = createMockLiquidation({
        nearbyLiquidationRisk: "HIGH",
        dominantSide: "LONG",
      });
      const riskContext: RiskContext = {
        baseRisk: 50,
        liquidationMultiplier: 1.3,
        treasuryMultiplier: 1,
        finalRisk: 65,
        riskLevel: "HIGH",
        explanation: "",
      };

      const insights = generateInsights("HOLD", riskContext, null, liq, null);

      expect(insights).toContain("LONG liquidations stacked nearby - volatility expected");
    });

    it("generates insight for extreme funding rate", () => {
      const derivatives = createMockDerivatives({ fundingRate: 0.06 }); // 6%
      const riskContext: RiskContext = {
        baseRisk: 50,
        liquidationMultiplier: 1,
        treasuryMultiplier: 1,
        finalRisk: 50,
        riskLevel: "MEDIUM",
        explanation: "",
      };

      const insights = generateInsights("HOLD", riskContext, null, null, derivatives);

      expect(insights.some((i) => i.includes("Extreme funding rate"))).toBe(true);
      expect(insights.some((i) => i.includes("crowded trade"))).toBe(true);
    });

    it("generates insight for low risk bullish signal", () => {
      const riskContext: RiskContext = {
        baseRisk: 20,
        liquidationMultiplier: 1,
        treasuryMultiplier: 1,
        finalRisk: 20,
        riskLevel: "LOW",
        explanation: "",
      };

      const insights = generateInsights("BUY", riskContext, null, null, null);

      expect(insights).toContain("Low risk environment supports bullish signals");
    });

    it("generates insight for STRONG_BUY in low risk", () => {
      const riskContext: RiskContext = {
        baseRisk: 15,
        liquidationMultiplier: 1,
        treasuryMultiplier: 1,
        finalRisk: 15,
        riskLevel: "LOW",
        explanation: "",
      };

      const insights = generateInsights("STRONG_BUY", riskContext, null, null, null);

      expect(insights).toContain("Low risk environment supports bullish signals");
    });

    it("combines multiple insights", () => {
      const treasury = createMockTreasury({ netChange30d: 3.0 });
      const liq = createMockLiquidation({ nearbyLiquidationRisk: "HIGH" });
      const riskContext: RiskContext = {
        baseRisk: 20,
        liquidationMultiplier: 1.3,
        treasuryMultiplier: 0.85,
        finalRisk: 22,
        riskLevel: "LOW",
        explanation: "",
      };

      const insights = generateInsights("BUY", riskContext, treasury, liq, null);

      expect(insights.length).toBeGreaterThanOrEqual(3);
    });

    it("returns empty array when no conditions met", () => {
      const treasury = createMockTreasury({
        hasInstitutionalHoldings: false,
        netChange30d: 0,
      });
      const riskContext: RiskContext = {
        baseRisk: 50,
        liquidationMultiplier: 1,
        treasuryMultiplier: 1,
        finalRisk: 50,
        riskLevel: "MEDIUM",
        explanation: "",
      };

      const insights = generateInsights("HOLD", riskContext, treasury, null, null);

      expect(insights.length).toBe(0);
    });
  });
});
