/** Context Domain - Pure functions for risk context computation */

import type {
  RiskContext,
  TreasuryContext,
  LiquidationContext,
  DerivativesContext,
} from "@0xsignal/shared";

/** Compute contextualized risk from base risk and external factors */
export const computeRiskContext = (
  baseRisk: number,
  liquidation: LiquidationContext | null,
  treasury: TreasuryContext | null
): RiskContext => {
  let liquidationMultiplier = 1.0;
  let treasuryMultiplier = 1.0;
  let riskFloor = 0;
  const explanations: string[] = [];

  if (liquidation?.hasLiquidationData) {
    if (liquidation.nearbyLiquidationRisk === "HIGH") {
      liquidationMultiplier = 1.3;
      riskFloor = 60;
      explanations.push("Critical: High liquidation clusters nearby");
    } else if (liquidation.nearbyLiquidationRisk === "MEDIUM") {
      liquidationMultiplier = 1.15;
      explanations.push("Moderate liquidation levels detected");
    }
  }

  if (treasury?.hasInstitutionalHoldings) {
    if (treasury.accumulationSignal === "strong_buy" || treasury.accumulationSignal === "buy") {
      treasuryMultiplier = 0.85;
      explanations.push("Institutional accumulation");
    } else if (
      treasury.accumulationSignal === "sell" ||
      treasury.accumulationSignal === "strong_sell"
    ) {
      treasuryMultiplier = 1.1;
      riskFloor = Math.max(riskFloor, 45);
      explanations.push("Institutional distribution");
    }
  }

  const calculatedRisk = baseRisk * liquidationMultiplier * treasuryMultiplier;
  const finalRisk = Math.min(100, Math.max(riskFloor, calculatedRisk));

  const riskLevel =
    finalRisk < 30 ? "LOW" : finalRisk < 50 ? "MEDIUM" : finalRisk < 75 ? "HIGH" : "EXTREME";

  return {
    baseRisk,
    liquidationMultiplier,
    treasuryMultiplier,
    finalRisk: Math.round(finalRisk),
    riskLevel,
    explanation: explanations.length > 0 ? explanations.join(" + ") : "Standard risk assessment",
  };
};

/** Classify liquidation risk level based on total USD value */
export const classifyLiquidationRisk = (totalLiquidationUsd: number): "LOW" | "MEDIUM" | "HIGH" => {
  if (totalLiquidationUsd > 50_000_000) return "HIGH";
  if (totalLiquidationUsd > 10_000_000) return "MEDIUM";
  return "LOW";
};

/** Determine dominant liquidation side from ratio */
export const classifyDominantSide = (liquidationRatio: number): "LONG" | "SHORT" | "BALANCED" => {
  if (liquidationRatio > 1.2) return "LONG";
  if (liquidationRatio < 0.8) return "SHORT";
  return "BALANCED";
};

/** Determine funding bias from funding rate */
export const classifyFundingBias = (
  fundingRate: number
): "LONG_HEAVY" | "SHORT_HEAVY" | "NEUTRAL" => {
  if (fundingRate > 0.01) return "LONG_HEAVY";
  if (fundingRate < -0.01) return "SHORT_HEAVY";
  return "NEUTRAL";
};

/** Generate actionable insights from context data */
export const generateInsights = (
  signal: string,
  riskContext: RiskContext,
  treasury: TreasuryContext | null,
  liquidation: LiquidationContext | null,
  derivatives: DerivativesContext | null
): readonly string[] => {
  const insights: string[] = [];

  if (treasury?.hasInstitutionalHoldings && treasury.netChange30d > 0) {
    insights.push(`Institutions accumulated ${treasury.netChange30d.toFixed(1)}% more in 30d`);
  }

  if (liquidation?.nearbyLiquidationRisk === "HIGH") {
    insights.push(`${liquidation.dominantSide} liquidations stacked nearby - volatility expected`);
  }

  if (derivatives && Math.abs(derivatives.fundingRate) > 0.05) {
    insights.push(
      `Extreme funding rate (${(derivatives.fundingRate * 100).toFixed(2)}%) - crowded trade`
    );
  }

  if (riskContext.riskLevel === "LOW" && (signal === "BUY" || signal === "STRONG_BUY")) {
    insights.push("Low risk environment supports bullish signals");
  }

  return insights;
};
