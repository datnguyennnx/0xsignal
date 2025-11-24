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

export const calculateRiskScore = (
  regime: string,
  confidence: number,
  volatility: number
): number => {
  let baseRisk = 50;

  switch (regime) {
    case "HIGH_VOLATILITY":
      baseRisk = 80;
      break;
    case "LOW_VOLATILITY":
      baseRisk = 40;
      break;
    case "BULL_MARKET":
      baseRisk = 30;
      break;
    case "BEAR_MARKET":
      baseRisk = 70;
      break;
    case "MEAN_REVERSION":
      baseRisk = 45;
      break;
    case "TRENDING":
      baseRisk = 35;
      break;
    case "SIDEWAYS":
      baseRisk = 50;
      break;
  }

  const confidenceAdjustment = (100 - confidence) * 0.2;
  const volatilityAdjustment = volatility * 0.3;

  return Math.round(Math.min(100, baseRisk + confidenceAdjustment + volatilityAdjustment));
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
