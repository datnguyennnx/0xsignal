/** Bollinger Band Width - Volatility squeeze indicator */
// BBW = (Upper Band - Lower Band) / Middle Band

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateBollingerBands } from "../volatility/bollinger-bands";
import type { CryptoPrice } from "@0xsignal/shared";

export interface BollingerWidthResult {
  readonly width: number;
  readonly widthPercent: number;
  readonly squeeze: "TIGHT" | "MODERATE" | "NORMAL" | "WIDE";
  readonly trend: "NARROWING" | "STABLE" | "WIDENING";
}

// Squeeze classification
const classifySqueeze = Match.type<number>().pipe(
  Match.when(
    (v) => v < 0.05,
    () => "TIGHT" as const
  ),
  Match.when(
    (v) => v < 0.1,
    () => "MODERATE" as const
  ),
  Match.when(
    (v) => v < 0.2,
    () => "NORMAL" as const
  ),
  Match.orElse(() => "WIDE" as const)
);

// Trend classification
const classifyTrend = Match.type<number>().pipe(
  Match.when(
    (v) => v < 0.08,
    () => "NARROWING" as const
  ),
  Match.when(
    (v) => v > 0.18,
    () => "WIDENING" as const
  ),
  Match.orElse(() => "STABLE" as const)
);

// Calculate Bollinger Band Width
export const calculateBollingerWidth = (
  upperBand: number,
  lowerBand: number,
  middleBand: number
): number => (middleBand === 0 ? 0 : (upperBand - lowerBand) / middleBand);

// Calculate BBWidth with interpretation
export const calculateBBWidth = (price: CryptoPrice): BollingerWidthResult => {
  const bb = calculateBollingerBands(price.price, price.high24h, price.low24h);
  const width = calculateBollingerWidth(bb.upperBand, bb.lowerBand, bb.middleBand);

  return {
    width: Math.round(width * 10000) / 10000,
    widthPercent: Math.round(width * 10000) / 100,
    squeeze: classifySqueeze(width),
    trend: classifyTrend(width),
  };
};

// Effect-based wrapper
export const computeBBWidth = (price: CryptoPrice): Effect.Effect<BollingerWidthResult> =>
  Effect.sync(() => calculateBBWidth(price));

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
