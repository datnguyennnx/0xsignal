/** Keltner Channel Width - ATR-based volatility */
// KCW = (Upper - Lower) / Middle

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";
import type { CryptoPrice } from "@0xsignal/shared";

export interface KeltnerWidthResult {
  readonly width: number;
  readonly widthPercent: number;
  readonly volatility: "VERY_LOW" | "LOW" | "NORMAL" | "HIGH" | "VERY_HIGH";
}

// Volatility classification
const classifyVolatility = Match.type<number>().pipe(
  Match.when(
    (v) => v < 0.04,
    () => "VERY_LOW" as const
  ),
  Match.when(
    (v) => v < 0.08,
    () => "LOW" as const
  ),
  Match.when(
    (v) => v < 0.15,
    () => "NORMAL" as const
  ),
  Match.when(
    (v) => v < 0.25,
    () => "HIGH" as const
  ),
  Match.orElse(() => "VERY_HIGH" as const)
);

// Calculate Keltner Width
export const calculateKeltnerWidth = (price: CryptoPrice): KeltnerWidthResult => {
  const atr =
    price.high24h && price.low24h ? (price.high24h - price.low24h) / 2 : price.price * 0.02;
  const middle = price.price;
  const multiplier = 2;
  const upper = middle + multiplier * atr;
  const lower = middle - multiplier * atr;
  const width = (upper - lower) / middle;

  return {
    width: Math.round(width * 10000) / 10000,
    widthPercent: Math.round(width * 10000) / 100,
    volatility: classifyVolatility(width),
  };
};

// Effect-based wrapper
export const computeKeltnerWidth = (price: CryptoPrice): Effect.Effect<KeltnerWidthResult> =>
  Effect.sync(() => calculateKeltnerWidth(price));

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
