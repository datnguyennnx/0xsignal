/** Scoring Tests - Using @effect/vitest */

import { expect, describe, it } from "vitest";
import {
  scoreToSignal,
  signalToScore,
  calculateRiskScore,
  calculateConfidence,
  calculateIndicatorAgreement,
  combineConfidence,
} from "../scoring";

describe("Scoring", () => {
  describe("scoreToSignal", () => {
    it("returns STRONG_BUY for score > 60", () => {
      expect(scoreToSignal(61)).toBe("STRONG_BUY");
      expect(scoreToSignal(100)).toBe("STRONG_BUY");
    });

    it("returns BUY for score > 20 and <= 60", () => {
      expect(scoreToSignal(21)).toBe("BUY");
      expect(scoreToSignal(60)).toBe("BUY");
    });

    it("returns STRONG_SELL for score < -60", () => {
      expect(scoreToSignal(-61)).toBe("STRONG_SELL");
      expect(scoreToSignal(-100)).toBe("STRONG_SELL");
    });

    it("returns SELL for score < -20 and >= -60", () => {
      expect(scoreToSignal(-21)).toBe("SELL");
      expect(scoreToSignal(-60)).toBe("SELL");
    });

    it("returns HOLD for score between -20 and 20", () => {
      expect(scoreToSignal(0)).toBe("HOLD");
      expect(scoreToSignal(20)).toBe("HOLD");
      expect(scoreToSignal(-20)).toBe("HOLD");
    });
  });

  describe("signalToScore", () => {
    it("returns 100 for STRONG_BUY", () => {
      expect(signalToScore("STRONG_BUY")).toBe(100);
    });

    it("returns 50 for BUY", () => {
      expect(signalToScore("BUY")).toBe(50);
    });

    it("returns 0 for HOLD", () => {
      expect(signalToScore("HOLD")).toBe(0);
    });

    it("returns -50 for SELL", () => {
      expect(signalToScore("SELL")).toBe(-50);
    });

    it("returns -100 for STRONG_SELL", () => {
      expect(signalToScore("STRONG_SELL")).toBe(-100);
    });
  });

  describe("calculateRiskScore", () => {
    it("returns higher risk for HIGH_VOLATILITY regime", () => {
      const highVolRisk = calculateRiskScore("HIGH_VOLATILITY", 50, 5);
      const lowVolRisk = calculateRiskScore("LOW_VOLATILITY", 50, 5);

      expect(highVolRisk).toBeGreaterThan(lowVolRisk);
    });

    it("returns lower risk for BULL_MARKET regime", () => {
      const bullRisk = calculateRiskScore("BULL_MARKET", 50, 3);
      const bearRisk = calculateRiskScore("BEAR_MARKET", 50, 3);

      expect(bullRisk).toBeLessThan(bearRisk);
    });

    it("adjusts risk based on confidence", () => {
      const highConfRisk = calculateRiskScore("TRENDING", 80, 3);
      const lowConfRisk = calculateRiskScore("TRENDING", 20, 3);

      expect(highConfRisk).toBeLessThan(lowConfRisk);
    });

    it("adjusts risk based on volatility", () => {
      const lowVolRisk = calculateRiskScore("TRENDING", 50, 1);
      const highVolRisk = calculateRiskScore("TRENDING", 50, 8);

      expect(highVolRisk).toBeGreaterThan(lowVolRisk);
    });

    it("adjusts risk based on indicator agreement", () => {
      const highAgreementRisk = calculateRiskScore("TRENDING", 50, 3, 0.9);
      const lowAgreementRisk = calculateRiskScore("TRENDING", 50, 3, 0.3);

      expect(highAgreementRisk).toBeLessThan(lowAgreementRisk);
    });

    it("clamps risk score between 15 and 85", () => {
      const extremeHighRisk = calculateRiskScore("HIGH_VOLATILITY", 10, 10, 0.1);
      const extremeLowRisk = calculateRiskScore("BULL_MARKET", 90, 1, 0.9);

      expect(extremeHighRisk).toBeLessThanOrEqual(85);
      expect(extremeLowRisk).toBeGreaterThanOrEqual(15);
    });
  });

  describe("calculateConfidence", () => {
    it("increases confidence with higher signal strength", () => {
      const highStrength = calculateConfidence(80, 0.7, 30, 3);
      const lowStrength = calculateConfidence(20, 0.7, 30, 3);

      expect(highStrength).toBeGreaterThan(lowStrength);
    });

    it("increases confidence with higher indicator agreement", () => {
      const highAgreement = calculateConfidence(50, 0.9, 30, 3);
      const lowAgreement = calculateConfidence(50, 0.3, 30, 3);

      expect(highAgreement).toBeGreaterThan(lowAgreement);
    });

    it("increases confidence with higher trend strength", () => {
      const strongTrend = calculateConfidence(50, 0.7, 50, 3);
      const weakTrend = calculateConfidence(50, 0.7, 10, 3);

      expect(strongTrend).toBeGreaterThan(weakTrend);
    });

    it("adjusts confidence based on volatility", () => {
      const normalVol = calculateConfidence(50, 0.7, 30, 3);
      const highVol = calculateConfidence(50, 0.7, 30, 8);

      expect(normalVol).toBeGreaterThan(highVol);
    });

    it("clamps confidence between 20 and 90", () => {
      const maxConf = calculateConfidence(100, 1.0, 100, 3);
      const minConf = calculateConfidence(0, 0, 0, 10);

      expect(maxConf).toBeLessThanOrEqual(90);
      expect(minConf).toBeGreaterThanOrEqual(20);
    });
  });

  describe("calculateIndicatorAgreement", () => {
    it("returns 0 agreement for empty indicators", () => {
      const result = calculateIndicatorAgreement([]);

      expect(result.agreement).toBe(0);
      expect(result.direction).toBe("NEUTRAL");
    });

    it("returns full agreement when all indicators agree on BUY", () => {
      const indicators = [
        { signal: "BUY" as const, weight: 30 },
        { signal: "BUY" as const, weight: 30 },
        { signal: "BUY" as const, weight: 40 },
      ];

      const result = calculateIndicatorAgreement(indicators);

      expect(result.agreement).toBe(1);
      expect(result.direction).toBe("BUY");
    });

    it("returns full agreement when all indicators agree on SELL", () => {
      const indicators = [
        { signal: "SELL" as const, weight: 30 },
        { signal: "SELL" as const, weight: 30 },
        { signal: "SELL" as const, weight: 40 },
      ];

      const result = calculateIndicatorAgreement(indicators);

      expect(result.agreement).toBe(1);
      expect(result.direction).toBe("SELL");
    });

    it("returns partial agreement for mixed signals", () => {
      const indicators = [
        { signal: "BUY" as const, weight: 50 },
        { signal: "SELL" as const, weight: 30 },
        { signal: "NEUTRAL" as const, weight: 20 },
      ];

      const result = calculateIndicatorAgreement(indicators);

      expect(result.agreement).toBeGreaterThan(0);
      expect(result.agreement).toBeLessThan(1);
      expect(result.direction).toBe("BUY");
    });

    it("returns NEUTRAL direction when buy and sell weights are equal", () => {
      const indicators = [
        { signal: "BUY" as const, weight: 50 },
        { signal: "SELL" as const, weight: 50 },
      ];

      const result = calculateIndicatorAgreement(indicators);

      expect(result.direction).toBe("NEUTRAL");
    });

    it("handles NEUTRAL signals correctly", () => {
      const indicators = [{ signal: "NEUTRAL" as const, weight: 100 }];

      const result = calculateIndicatorAgreement(indicators);

      expect(result.agreement).toBe(0);
      expect(result.direction).toBe("NEUTRAL");
    });
  });

  describe("combineConfidence", () => {
    it("returns 0 for empty array", () => {
      expect(combineConfidence([])).toBe(0);
    });

    it("returns average for unweighted confidences", () => {
      const result = combineConfidence([60, 80, 70]);

      expect(result).toBe(70);
    });

    it("returns weighted average when weights provided", () => {
      const result = combineConfidence([60, 80], [1, 3]);

      // (60*1 + 80*3) / 4 = 300/4 = 75
      expect(result).toBe(75);
    });

    it("handles single confidence value", () => {
      expect(combineConfidence([75])).toBe(75);
    });

    it("rounds result to integer", () => {
      const result = combineConfidence([60, 70, 80]);

      expect(Number.isInteger(result)).toBe(true);
    });
  });
});
