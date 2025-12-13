/** Context Domain Tests */

import { describe, it, expect } from "vitest";
import type { RiskContext, TreasuryContext, DerivativesContext } from "@0xsignal/shared";
import { computeRiskContext, classifyFundingBias, generateInsights } from "../index";

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
      const result = computeRiskContext(50, null);

      expect(result.baseRisk).toBe(50);
      expect(result.finalRisk).toBe(50);
      expect(result.treasuryMultiplier).toBe(1.0);
      expect(result.riskLevel).toBe("HIGH"); // 50 is >= 50, so HIGH
      expect(result.explanation).toBe("Standard risk assessment");
    });

    it("applies 0.85x multiplier for institutional accumulation (buy)", () => {
      const treasury = createMockTreasury({ accumulationSignal: "buy" });
      const result = computeRiskContext(50, treasury);

      expect(result.treasuryMultiplier).toBe(0.85);
      expect(result.finalRisk).toBe(43); // 50 * 0.85 = 42.5, rounded
      expect(result.explanation).toContain("Institutional accumulation");
    });

    it("applies 0.85x multiplier for strong_buy", () => {
      const treasury = createMockTreasury({ accumulationSignal: "strong_buy" });
      const result = computeRiskContext(50, treasury);

      expect(result.treasuryMultiplier).toBe(0.85);
    });

    it("applies 1.1x multiplier for institutional distribution (sell)", () => {
      const treasury = createMockTreasury({ accumulationSignal: "sell" });
      const result = computeRiskContext(50, treasury);

      expect(result.treasuryMultiplier).toBe(1.1);
      expect(result.explanation).toContain("Institutional distribution");
    });

    it("enforces risk floor of 45 for institutional distribution", () => {
      const treasury = createMockTreasury({ accumulationSignal: "strong_sell" });
      // Base risk 30 * 1.1 = 33, but floor is 45
      const result = computeRiskContext(30, treasury);

      expect(result.finalRisk).toBe(45);
      expect(result.riskLevel).toBe("MEDIUM");
    });

    it("caps final risk at 100", () => {
      const treasury = createMockTreasury({ accumulationSignal: "sell" });
      // 95 * 1.1 = 104.5, capped at 100
      const result = computeRiskContext(95, treasury);

      expect(result.finalRisk).toBe(100);
      expect(result.riskLevel).toBe("EXTREME");
    });

    it("classifies risk levels correctly", () => {
      expect(computeRiskContext(20, null).riskLevel).toBe("LOW");
      expect(computeRiskContext(40, null).riskLevel).toBe("MEDIUM");
      expect(computeRiskContext(60, null).riskLevel).toBe("HIGH");
      expect(computeRiskContext(80, null).riskLevel).toBe("EXTREME");
    });

    it("ignores treasury without institutional holdings", () => {
      const treasury = createMockTreasury({
        hasInstitutionalHoldings: false,
        accumulationSignal: "strong_buy",
      });
      const result = computeRiskContext(50, treasury);

      expect(result.treasuryMultiplier).toBe(1.0);
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
        treasuryMultiplier: 1,
        finalRisk: 50,
        riskLevel: "MEDIUM",
        explanation: "",
      };

      const insights = generateInsights("HOLD", riskContext, treasury, null);

      expect(insights).toContain("Institutions accumulated 5.5% more in 30d");
    });

    it("does not generate insight for negative net change", () => {
      const treasury = createMockTreasury({ netChange30d: -2.0 });
      const riskContext: RiskContext = {
        baseRisk: 50,
        treasuryMultiplier: 1,
        finalRisk: 50,
        riskLevel: "MEDIUM",
        explanation: "",
      };

      const insights = generateInsights("HOLD", riskContext, treasury, null);

      expect(insights.length).toBe(0);
    });

    it("generates insight for extreme funding rate", () => {
      const derivatives = createMockDerivatives({ fundingRate: 0.06 }); // 6%
      const riskContext: RiskContext = {
        baseRisk: 50,
        treasuryMultiplier: 1,
        finalRisk: 50,
        riskLevel: "MEDIUM",
        explanation: "",
      };

      const insights = generateInsights("HOLD", riskContext, null, derivatives);

      expect(insights.some((i) => i.includes("Extreme funding rate"))).toBe(true);
      expect(insights.some((i) => i.includes("crowded trade"))).toBe(true);
    });

    it("generates insight for low risk bullish signal", () => {
      const riskContext: RiskContext = {
        baseRisk: 20,
        treasuryMultiplier: 1,
        finalRisk: 20,
        riskLevel: "LOW",
        explanation: "",
      };

      const insights = generateInsights("BUY", riskContext, null, null);

      expect(insights).toContain("Low risk environment supports bullish signals");
    });

    it("generates insight for STRONG_BUY in low risk", () => {
      const riskContext: RiskContext = {
        baseRisk: 15,
        treasuryMultiplier: 1,
        finalRisk: 15,
        riskLevel: "LOW",
        explanation: "",
      };

      const insights = generateInsights("STRONG_BUY", riskContext, null, null);

      expect(insights).toContain("Low risk environment supports bullish signals");
    });

    it("combines multiple insights", () => {
      const treasury = createMockTreasury({ netChange30d: 3.0 });
      const derivatives = createMockDerivatives({ fundingRate: 0.06 });
      const riskContext: RiskContext = {
        baseRisk: 20,
        treasuryMultiplier: 0.85,
        finalRisk: 17,
        riskLevel: "LOW",
        explanation: "",
      };

      const insights = generateInsights("BUY", riskContext, treasury, derivatives);

      expect(insights.length).toBeGreaterThanOrEqual(3);
    });

    it("returns empty array when no conditions met", () => {
      const treasury = createMockTreasury({
        hasInstitutionalHoldings: false,
        netChange30d: 0,
      });
      const riskContext: RiskContext = {
        baseRisk: 50,
        treasuryMultiplier: 1,
        finalRisk: 50,
        riskLevel: "MEDIUM",
        explanation: "",
      };

      const insights = generateInsights("HOLD", riskContext, treasury, null);

      expect(insights.length).toBe(0);
    });
  });
});
