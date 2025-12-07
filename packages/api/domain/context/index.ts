/** Context Domain - Pure functions for risk context computation */

import type { RiskContext, TreasuryContext, DerivativesContext } from "@0xsignal/shared";

/** Compute contextualized risk from base risk and external factors */
export const computeRiskContext = (
  baseRisk: number,
  treasury: TreasuryContext | null
): RiskContext => {
  let treasuryMultiplier = 1.0;
  let riskFloor = 0;
  const explanations: string[] = [];

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

  const calculatedRisk = baseRisk * treasuryMultiplier;
  const finalRisk = Math.min(100, Math.max(riskFloor, calculatedRisk));

  const riskLevel =
    finalRisk < 30 ? "LOW" : finalRisk < 50 ? "MEDIUM" : finalRisk < 75 ? "HIGH" : "EXTREME";

  return {
    baseRisk,
    treasuryMultiplier,
    finalRisk: Math.round(finalRisk),
    riskLevel,
    explanation: explanations.length > 0 ? explanations.join(" + ") : "Standard risk assessment",
  };
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
  derivatives: DerivativesContext | null
): readonly string[] => {
  const insights: string[] = [];

  if (treasury?.hasInstitutionalHoldings && treasury.netChange30d > 0) {
    insights.push(`Institutions accumulated ${treasury.netChange30d.toFixed(1)}% more in 30d`);
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
