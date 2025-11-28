import type { Signal } from "../types";

export const scoreToSignal = (score: number): Signal => {
  if (score > 60) return "STRONG_BUY";
  if (score > 20) return "BUY";
  if (score < -60) return "STRONG_SELL";
  if (score < -20) return "SELL";
  return "HOLD";
};

export const signalToScore = (signal: Signal): number => {
  switch (signal) {
    case "STRONG_BUY":
      return 100;
    case "BUY":
      return 50;
    case "HOLD":
      return 0;
    case "SELL":
      return -50;
    case "STRONG_SELL":
      return -100;
  }
};

/**
 * Calculate risk score based on multiple factors
 * Designed to provide meaningful differentiation
 */
export const calculateRiskScore = (
  regime: string,
  confidence: number,
  volatility: number,
  indicatorAgreement?: number // 0-1, how many indicators agree
): number => {
  // Base risk by regime (20-70 range)
  const regimeRisk: Record<string, number> = {
    HIGH_VOLATILITY: 70,
    BEAR_MARKET: 65,
    SIDEWAYS: 45,
    MEAN_REVERSION: 40,
    TRENDING: 35,
    LOW_VOLATILITY: 30,
    BULL_MARKET: 25,
  };

  const baseRisk = regimeRisk[regime] ?? 45;

  // Confidence adjustment (-15 to +15)
  // High confidence = lower risk, low confidence = higher risk
  const confidenceAdjust = (50 - confidence) * 0.3;

  // Volatility adjustment (-5 to +15)
  // Moderate volatility (2-4%) is acceptable
  let volatilityAdjust = 0;
  if (volatility < 2) {
    volatilityAdjust = -5; // Low vol = lower risk
  } else if (volatility > 6) {
    volatilityAdjust = 15; // High vol = higher risk
  } else if (volatility > 4) {
    volatilityAdjust = 5;
  }

  // Agreement adjustment (-5 to +10)
  // Low agreement = higher risk
  const agreementAdjust = indicatorAgreement !== undefined ? (0.5 - indicatorAgreement) * 20 : 5;

  const totalRisk = baseRisk + confidenceAdjust + volatilityAdjust + agreementAdjust;

  return Math.round(Math.max(15, Math.min(85, totalRisk)));
};

/**
 * Calculate confidence based on indicator agreement and signal strength
 * Designed to work well with limited 24h data
 */
export const calculateConfidence = (
  signalStrength: number, // -100 to 100
  indicatorAgreement: number, // 0-1
  trendStrength: number, // ADX value
  volatility: number // normalized ATR
): number => {
  // Base confidence from signal strength (0-40)
  const strengthConfidence = Math.abs(signalStrength) * 0.4;

  // Indicator agreement bonus (20-50 based on agreement)
  // Even low agreement gets some base confidence
  const agreementBonus = 20 + indicatorAgreement * 30;

  // Trend strength bonus (0-15)
  // With limited data, ADX is often 0, so we use a smaller weight
  const trendBonus = Math.min(15, trendStrength * 0.4);

  // Volatility adjustment (-10 to +5)
  // Moderate volatility (2-4%) is ideal
  let volatilityAdjust = 0;
  if (volatility < 2) {
    volatilityAdjust = -5; // Too quiet, less reliable
  } else if (volatility > 6) {
    volatilityAdjust = -10; // Too volatile
  } else {
    volatilityAdjust = 5; // Ideal range
  }

  const confidence = strengthConfidence + agreementBonus + trendBonus + volatilityAdjust;

  return Math.round(Math.max(20, Math.min(90, confidence)));
};

/**
 * Calculate indicator agreement ratio
 * Returns 0-1 based on how many indicators point in the same direction
 */
export const calculateIndicatorAgreement = (
  indicators: ReadonlyArray<{ signal: "BUY" | "SELL" | "NEUTRAL"; weight: number }>
): { agreement: number; direction: "BUY" | "SELL" | "NEUTRAL" } => {
  if (indicators.length === 0) return { agreement: 0, direction: "NEUTRAL" };

  let buyWeight = 0;
  let sellWeight = 0;
  let totalWeight = 0;

  for (const ind of indicators) {
    totalWeight += ind.weight;
    if (ind.signal === "BUY") buyWeight += ind.weight;
    else if (ind.signal === "SELL") sellWeight += ind.weight;
  }

  const maxWeight = Math.max(buyWeight, sellWeight);
  const agreement = totalWeight > 0 ? maxWeight / totalWeight : 0;
  const direction = buyWeight > sellWeight ? "BUY" : sellWeight > buyWeight ? "SELL" : "NEUTRAL";

  return { agreement, direction };
};

export const combineConfidence = (
  confidences: ReadonlyArray<number>,
  weights?: ReadonlyArray<number>
): number => {
  if (confidences.length === 0) return 0;

  if (!weights || weights.length !== confidences.length) {
    return Math.round(confidences.reduce((sum, c) => sum + c, 0) / confidences.length);
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const weightedSum = confidences.reduce((sum, c, i) => sum + c * weights[i], 0);

  return Math.round(weightedSum / totalWeight);
};
