import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateBollingerBands } from "../volatility/bollinger-bands";
import type { CryptoPrice } from "@0xsignal/shared";

// ============================================================================
// PERCENT B (%B) - Position Within Bollinger Bands
// ============================================================================
// Measures where price is relative to Bollinger Bands
//
// Formula:
// %B = (Price - Lower Band) / (Upper Band - Lower Band)
//
// Interpretation:
// - %B > 1.0: Price above upper band (overbought)
// - %B = 0.5: Price at middle band (neutral)
// - %B < 0.0: Price below lower band (oversold)
// - %B > 0.8: Approaching overbought
// - %B < 0.2: Approaching oversold
// ============================================================================

export interface PercentBResult {
  readonly value: number; // %B value (can be <0 or >1)
  readonly signal: "EXTREME_OVERBOUGHT" | "OVERBOUGHT" | "NEUTRAL" | "OVERSOLD" | "EXTREME_OVERSOLD";
  readonly position: "ABOVE_BANDS" | "UPPER_HALF" | "MIDDLE" | "LOWER_HALF" | "BELOW_BANDS";
  readonly meanReversionSetup: boolean; // True if good mean reversion opportunity
}

/**
 * Pure function to calculate Percent B
 * @param price - Current price
 * @param upperBand - Upper Bollinger Band
 * @param lowerBand - Lower Bollinger Band
 */
export const calculatePercentB = (
  price: number,
  upperBand: number,
  lowerBand: number
): number => {
  const bandWidth = upperBand - lowerBand;
  return bandWidth === 0 ? 0.5 : (price - lowerBand) / bandWidth;
};

/**
 * Pure function to calculate Percent B with interpretation
 * Works with CryptoPrice (single price point)
 */
export const calculatePctB = (price: CryptoPrice): PercentBResult => {
  // Calculate Bollinger Bands
  const bb = calculateBollingerBands(price.price, price.high24h, price.low24h);

  // Calculate %B
  const value = calculatePercentB(price.price, bb.upperBand, bb.lowerBand);

  // Determine signal
  let signal: "EXTREME_OVERBOUGHT" | "OVERBOUGHT" | "NEUTRAL" | "OVERSOLD" | "EXTREME_OVERSOLD";
  if (value > 1.2) {
    signal = "EXTREME_OVERBOUGHT";
  } else if (value > 0.8) {
    signal = "OVERBOUGHT";
  } else if (value < -0.2) {
    signal = "EXTREME_OVERSOLD";
  } else if (value < 0.2) {
    signal = "OVERSOLD";
  } else {
    signal = "NEUTRAL";
  }

  // Determine position
  let position: "ABOVE_BANDS" | "UPPER_HALF" | "MIDDLE" | "LOWER_HALF" | "BELOW_BANDS";
  if (value > 1.0) {
    position = "ABOVE_BANDS";
  } else if (value > 0.6) {
    position = "UPPER_HALF";
  } else if (value > 0.4) {
    position = "MIDDLE";
  } else if (value >= 0.0) {
    position = "LOWER_HALF";
  } else {
    position = "BELOW_BANDS";
  }

  // Mean reversion setup: price at extremes
  const meanReversionSetup = value > 1.0 || value < 0.0;

  return {
    value: Math.round(value * 10000) / 10000,
    signal,
    position,
    meanReversionSetup,
  };
};

/**
 * Effect-based wrapper for Percent B calculation
 */
export const computePercentB = (
  price: CryptoPrice
): Effect.Effect<PercentBResult> => Effect.sync(() => calculatePctB(price));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const PercentBMetadata: FormulaMetadata = {
  name: "PercentB",
  category: "statistical",
  difficulty: "intermediate",
  description: "Percent B - position within Bollinger Bands",
  requiredInputs: ["price", "high24h", "low24h"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "PercentBResult",
  useCases: [
    "overbought/oversold detection",
    "mean reversion trading",
    "band breakout identification",
    "relative price position",
  ],
  timeComplexity: "O(1)",
  dependencies: ["BollingerBands"],
};
