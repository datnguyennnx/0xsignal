import { Effect } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateSMA } from "../trend/moving-averages";

// ============================================================================
// DPO (Detrended Price Oscillator) - Cycle Identification
// ============================================================================
// Removes the trend from price to identify cycles
// Helps traders identify overbought/oversold levels and cycle turning points
//
// Formula:
// DPO = Close - SMA(Close, period)[period/2 + 1 periods ago]
//
// Interpretation:
// - DPO > 0: Price above the displaced moving average
// - DPO < 0: Price below the displaced moving average
// - DPO peaks: Overbought
// - DPO troughs: Oversold
// - Used to identify cycle length
// ============================================================================

export interface DPOResult {
  readonly value: number; // DPO value
  readonly signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  readonly cycle: "PEAK" | "TROUGH" | "NEUTRAL";
}

/**
 * Pure function to calculate DPO
 * @param closes - Array of closing prices
 * @param period - DPO period (default: 20)
 */
export const calculateDPO = (
  closes: ReadonlyArray<number>,
  period: number = 20
): DPOResult => {
  // Calculate displacement
  const displacement = Math.floor(period / 2) + 1;

  // Need enough data for SMA and displacement
  if (closes.length < period + displacement) {
    return {
      value: 0,
      signal: "NEUTRAL",
      cycle: "NEUTRAL",
    };
  }

  // Calculate SMA at the displaced position
  const displacedIndex = closes.length - displacement;
  const smaWindow = closes.slice(
    displacedIndex - period + 1,
    displacedIndex + 1
  );
  const sma = smaWindow.reduce((a, b) => a + b, 0) / period;

  // Calculate DPO
  const currentClose = closes[closes.length - 1];
  const dpo = currentClose - sma;

  // Determine signal based on DPO magnitude
  let signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  const threshold = sma * 0.02; // 2% threshold
  if (dpo > threshold) {
    signal = "OVERBOUGHT";
  } else if (dpo < -threshold) {
    signal = "OVERSOLD";
  } else {
    signal = "NEUTRAL";
  }

  // Determine cycle position (simplified)
  let cycle: "PEAK" | "TROUGH" | "NEUTRAL" = "NEUTRAL";
  if (closes.length > displacement + 2) {
    const prevDPO =
      closes[closes.length - 2] -
      closes
        .slice(displacedIndex - period, displacedIndex)
        .reduce((a, b) => a + b, 0) /
        period;

    if (dpo > 0 && dpo < prevDPO) {
      cycle = "PEAK";
    } else if (dpo < 0 && dpo > prevDPO) {
      cycle = "TROUGH";
    }
  }

  return {
    value: Math.round(dpo * 100) / 100,
    signal,
    cycle,
  };
};

/**
 * Pure function to calculate DPO series
 */
export const calculateDPOSeries = (
  closes: ReadonlyArray<number>,
  period: number = 20
): ReadonlyArray<number> => {
  const dpoSeries: number[] = [];
  const displacement = Math.floor(period / 2) + 1;

  for (let i = period + displacement - 1; i < closes.length; i++) {
    const displacedIndex = i - displacement;
    const smaWindow = closes.slice(
      displacedIndex - period + 1,
      displacedIndex + 1
    );
    const sma = smaWindow.reduce((a, b) => a + b, 0) / period;
    const dpo = closes[i] - sma;
    dpoSeries.push(dpo);
  }

  return dpoSeries;
};

/**
 * Effect-based wrapper for DPO calculation
 */
export const computeDPO = (
  closes: ReadonlyArray<number>,
  period: number = 20
): Effect.Effect<DPOResult> =>
  Effect.sync(() => calculateDPO(closes, period));

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const DPOMetadata: FormulaMetadata = {
  name: "DPO",
  category: "oscillators",
  difficulty: "intermediate",
  description:
    "Detrended Price Oscillator - removes trend to identify cycles",
  requiredInputs: ["closes"],
  optionalInputs: ["period"],
  minimumDataPoints: 31,
  outputType: "DPOResult",
  useCases: [
    "cycle identification",
    "overbought/oversold detection",
    "trend removal",
    "cycle length measurement",
  ],
  timeComplexity: "O(n)",
  dependencies: ["SMA"],
};
