import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// MFI (Money Flow Index) - Volume-Weighted RSI
// ============================================================================
// Oscillator that uses price and volume to identify overbought/oversold conditions
// Similar to RSI but incorporates volume
//
// Formula:
// Typical Price = (High + Low + Close) / 3
// Raw Money Flow = Typical Price × Volume
// Money Flow Ratio = (14-period Positive Money Flow) / (14-period Negative Money Flow)
// MFI = 100 - (100 / (1 + Money Flow Ratio))
//
// Interpretation:
// - MFI > 80: Overbought
// - MFI < 20: Oversold
// - MFI divergence: Potential reversal
// ============================================================================

export interface MFIResult {
  readonly value: number; // MFI value (0-100)
  readonly signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  readonly moneyFlowRatio: number;
}

/**
 * Pure function to calculate MFI
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param closes - Array of closing prices
 * @param volumes - Array of volumes
 * @param period - MFI period (default: 14)
 */
export const calculateMFI = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 14
): MFIResult => {
  // Calculate typical prices and raw money flow
  const typicalPrices: number[] = [];
  const rawMoneyFlow: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    typicalPrices.push(tp);
    rawMoneyFlow.push(tp * volumes[i]);
  }

  // Separate positive and negative money flow
  let positiveFlow = 0;
  let negativeFlow = 0;

  for (let i = Math.max(1, closes.length - period); i < closes.length; i++) {
    if (typicalPrices[i] > typicalPrices[i - 1]) {
      positiveFlow += rawMoneyFlow[i];
    } else if (typicalPrices[i] < typicalPrices[i - 1]) {
      negativeFlow += rawMoneyFlow[i];
    }
  }

  // Calculate money flow ratio and MFI
  const moneyFlowRatio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
  const mfi = 100 - 100 / (1 + moneyFlowRatio);

  // Determine signal
  let signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  if (mfi > 80) {
    signal = "OVERBOUGHT";
  } else if (mfi < 20) {
    signal = "OVERSOLD";
  } else {
    signal = "NEUTRAL";
  }

  return {
    value: Math.round(mfi * 100) / 100,
    signal,
    moneyFlowRatio: Math.round(moneyFlowRatio * 100) / 100,
  };
};

/**
 * Pure function to calculate MFI series
 */
export const calculateMFISeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 14
): ReadonlyArray<number> => {
  const mfiSeries: number[] = [];

  // Calculate typical prices and raw money flow
  const typicalPrices: number[] = [];
  const rawMoneyFlow: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    typicalPrices.push(tp);
    rawMoneyFlow.push(tp * volumes[i]);
  }

  // Calculate MFI for each point
  for (let i = period; i < closes.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        positiveFlow += rawMoneyFlow[j];
      } else if (typicalPrices[j] < typicalPrices[j - 1]) {
        negativeFlow += rawMoneyFlow[j];
      }
    }

    const ratio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
    const mfi = 100 - 100 / (1 + ratio);
    mfiSeries.push(mfi);
  }

  return mfiSeries;
};

/**
 * Effect-based wrapper for MFI calculation
 */
export const computeMFI = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 14
): Effect.Effect<MFIResult> =>
  Effect.sync(() => calculateMFI(highs, lows, closes, volumes, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const MFIMetadata: FormulaMetadata = {
  name: "MFI",
  category: "volume",
  difficulty: "intermediate",
  description: "Money Flow Index - volume-weighted RSI oscillator",
  requiredInputs: ["highs", "lows", "closes", "volumes"],
  optionalInputs: ["period"],
  minimumDataPoints: 15,
  outputType: "MFIResult",
  useCases: [
    "overbought/oversold detection",
    "divergence analysis",
    "volume confirmation",
    "reversal signals",
  ],
  timeComplexity: "O(n * k)",
  dependencies: [],
};
