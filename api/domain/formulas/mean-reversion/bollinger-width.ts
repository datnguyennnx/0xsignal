import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateBollingerBands } from "../volatility/bollinger-bands";
import type { CryptoPrice } from "@0xsignal/shared";

// ============================================================================
// BOLLINGER BAND WIDTH - Volatility Squeeze Indicator
// ============================================================================
// Measures the width of Bollinger Bands relative to the middle band
// Narrow bands indicate low volatility (squeeze) - often precedes big moves
//
// Formula:
// BBW = (Upper Band - Lower Band) / Middle Band
//
// Interpretation:
// - BBW < 0.05: Tight squeeze (very low volatility)
// - BBW < 0.10: Squeeze (low volatility)
// - BBW > 0.20: Wide bands (high volatility)
// - Narrowing bands: Volatility decreasing
// - Widening bands: Volatility increasing
// ============================================================================

export interface BollingerWidthResult {
  readonly width: number; // Normalized width (0-1+)
  readonly widthPercent: number; // Width as percentage
  readonly squeeze: "TIGHT" | "MODERATE" | "NORMAL" | "WIDE";
  readonly trend: "NARROWING" | "STABLE" | "WIDENING";
}

/**
 * Pure function to calculate Bollinger Band Width
 * @param upperBand - Upper Bollinger Band
 * @param lowerBand - Lower Bollinger Band
 * @param middleBand - Middle Bollinger Band (SMA)
 */
export const calculateBollingerWidth = (
  upperBand: number,
  lowerBand: number,
  middleBand: number
): number => {
  return middleBand === 0 ? 0 : (upperBand - lowerBand) / middleBand;
};

/**
 * Pure function to calculate Bollinger Band Width with interpretation
 * Works with CryptoPrice (single price point)
 */
export const calculateBBWidth = (price: CryptoPrice): BollingerWidthResult => {
  // Calculate Bollinger Bands
  const bb = calculateBollingerBands(price.price, price.high24h, price.low24h);

  // Calculate width
  const width = calculateBollingerWidth(bb.upperBand, bb.lowerBand, bb.middleBand);
  const widthPercent = width * 100;

  // Determine squeeze level
  let squeeze: "TIGHT" | "MODERATE" | "NORMAL" | "WIDE";
  if (width < 0.05) {
    squeeze = "TIGHT";
  } else if (width < 0.10) {
    squeeze = "MODERATE";
  } else if (width < 0.20) {
    squeeze = "NORMAL";
  } else {
    squeeze = "WIDE";
  }

  // Determine trend (simplified - would need historical data for accurate trend)
  // For now, use bandwidth to infer
  const trend: "NARROWING" | "STABLE" | "WIDENING" =
    width < 0.08 ? "NARROWING" : width > 0.18 ? "WIDENING" : "STABLE";

  return {
    width: Math.round(width * 10000) / 10000,
    widthPercent: Math.round(widthPercent * 100) / 100,
    squeeze,
    trend,
  };
};

/**
 * Effect-based wrapper for Bollinger Band Width calculation
 */
export const computeBBWidth = (
  price: CryptoPrice
): Effect.Effect<BollingerWidthResult> =>
  Effect.sync(() => calculateBBWidth(price));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const BollingerWidthMetadata: FormulaMetadata = {
  name: "BollingerWidth",
  category: "statistical",
  difficulty: "intermediate",
  description: "Bollinger Band Width - measures volatility squeeze",
  requiredInputs: ["price", "high24h", "low24h"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "BollingerWidthResult",
  useCases: [
    "volatility squeeze detection",
    "breakout prediction",
    "low volatility identification",
    "mean reversion setup",
  ],
  timeComplexity: "O(1)",
  dependencies: ["BollingerBands"],
};
