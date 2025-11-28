import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import type { NoiseScore } from "@0xsignal/shared";

// ============================================================================
// NOISE SCORE - Signal Quality Measurement
// ============================================================================
// Measures signal reliability based on market conditions
// Combines multiple factors:
// 1. ADX (trend strength) - low ADX = high noise (no clear direction)
// 2. Normalized ATR (volatility) - extreme volatility = high noise
// 3. Indicator agreement - low agreement = high noise (conflicting signals)
//
// For quant researchers:
// - Low noise (0-30): High conviction signals, clear market structure
// - Moderate noise (30-55): Tradeable with proper risk management
// - High noise (55-75): Reduced position size, wider stops
// - Extreme noise (75-100): Avoid or use contrarian approach
// ============================================================================

/**
 * Calculate noise score from market indicators
 * @param adx - ADX value (0-100, higher = stronger trend)
 * @param normalizedATR - ATR as percentage of price
 * @param indicatorAgreement - Optional: 0-1, how many indicators agree
 */
export const calculateNoiseScore = (
  adx: number,
  normalizedATR: number,
  indicatorAgreement?: number
): NoiseScore => {
  // ADX contribution (40%): low ADX = high noise
  // ADX < 15 = very noisy, ADX > 35 = clean trend
  const adxNoise = Math.max(0, Math.min(100, (35 - adx) * 2.85));

  // ATR contribution (30%): extreme volatility = high noise
  // But moderate volatility is fine - we penalize extremes
  // normalizedATR 2-4% is ideal, <1% or >6% is noisy
  let atrNoise: number;
  if (normalizedATR < 1) {
    atrNoise = 40; // Too quiet, potential for sudden moves
  } else if (normalizedATR > 6) {
    atrNoise = Math.min(100, 40 + (normalizedATR - 6) * 10);
  } else if (normalizedATR > 4) {
    atrNoise = (normalizedATR - 4) * 20;
  } else {
    atrNoise = 0; // Ideal volatility range
  }

  // Indicator agreement contribution (30%)
  // Low agreement = conflicting signals = high noise
  const agreementNoise =
    indicatorAgreement !== undefined ? Math.max(0, (0.6 - indicatorAgreement) * 166) : 35;

  // Weighted combination
  const weights = indicatorAgreement !== undefined ? [0.4, 0.3, 0.3] : [0.55, 0.45, 0];

  const noiseValue = Math.round(
    adxNoise * weights[0] + atrNoise * weights[1] + agreementNoise * weights[2]
  );

  const clampedNoise = Math.max(0, Math.min(100, noiseValue));

  const level: NoiseScore["level"] =
    clampedNoise < 30
      ? "LOW"
      : clampedNoise < 55
        ? "MODERATE"
        : clampedNoise < 75
          ? "HIGH"
          : "EXTREME";

  return {
    value: clampedNoise,
    level,
  };
};

/**
 * Effect-based wrapper for noise calculation
 */
export const computeNoiseScore = (
  adx: number,
  normalizedATR: number,
  priceEfficiency?: number
): Effect.Effect<NoiseScore> =>
  Effect.sync(() => calculateNoiseScore(adx, normalizedATR, priceEfficiency));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const NoiseScoreMetadata: FormulaMetadata = {
  name: "NoiseScore",
  category: "statistical",
  difficulty: "intermediate",
  description: "Noise Score - measures signal clarity vs market randomness",
  requiredInputs: ["adx", "normalizedATR"],
  optionalInputs: ["priceEfficiency"],
  minimumDataPoints: 1,
  outputType: "NoiseScore",
  useCases: [
    "signal quality assessment",
    "trade filtering",
    "position sizing",
    "market regime detection",
  ],
  timeComplexity: "O(1)",
  dependencies: ["ADX", "ATR"],
};
