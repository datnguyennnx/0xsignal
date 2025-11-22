import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import type { CryptoPrice } from "@0xsignal/shared";

// ============================================================================
// KELTNER CHANNEL WIDTH - Volatility Measurement
// ============================================================================
// Measures the width of Keltner Channels relative to the middle line
// Similar to Bollinger Width but uses ATR instead of standard deviation
//
// Formula:
// KCW = (Upper Channel - Lower Channel) / Middle Line
//
// Interpretation:
// - Low KCW: Low volatility, potential breakout setup
// - High KCW: High volatility, trending market
// - Narrowing: Volatility contracting
// - Widening: Volatility expanding
// ============================================================================

export interface KeltnerWidthResult {
  readonly width: number; // Normalized width
  readonly widthPercent: number; // Width as percentage
  readonly volatility: "VERY_LOW" | "LOW" | "NORMAL" | "HIGH" | "VERY_HIGH";
}

/**
 * Pure function to calculate Keltner Channel Width
 * Approximation using 24h data
 */
export const calculateKeltnerWidth = (price: CryptoPrice): KeltnerWidthResult => {
  // Approximate ATR using 24h range
  const atr = price.high24h && price.low24h ? (price.high24h - price.low24h) / 2 : price.price * 0.02;

  // Approximate EMA using current price
  const middle = price.price;

  // Keltner Channels with multiplier of 2
  const multiplier = 2;
  const upper = middle + multiplier * atr;
  const lower = middle - multiplier * atr;

  // Calculate width
  const width = (upper - lower) / middle;
  const widthPercent = width * 100;

  // Determine volatility level
  let volatility: "VERY_LOW" | "LOW" | "NORMAL" | "HIGH" | "VERY_HIGH";
  if (width < 0.04) {
    volatility = "VERY_LOW";
  } else if (width < 0.08) {
    volatility = "LOW";
  } else if (width < 0.15) {
    volatility = "NORMAL";
  } else if (width < 0.25) {
    volatility = "HIGH";
  } else {
    volatility = "VERY_HIGH";
  }

  return {
    width: Math.round(width * 10000) / 10000,
    widthPercent: Math.round(widthPercent * 100) / 100,
    volatility,
  };
};

/**
 * Effect-based wrapper for Keltner Channel Width calculation
 */
export const computeKeltnerWidth = (
  price: CryptoPrice
): Effect.Effect<KeltnerWidthResult> =>
  Effect.sync(() => calculateKeltnerWidth(price));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const KeltnerWidthMetadata: FormulaMetadata = {
  name: "KeltnerWidth",
  category: "statistical",
  difficulty: "intermediate",
  description: "Keltner Channel Width - ATR-based volatility measurement",
  requiredInputs: ["price", "high24h", "low24h"],
  optionalInputs: [],
  minimumDataPoints: 1,
  outputType: "KeltnerWidthResult",
  useCases: [
    "volatility measurement",
    "breakout setup identification",
    "trend strength assessment",
    "channel-based trading",
  ],
  timeComplexity: "O(1)",
  dependencies: ["ATR"],
};
