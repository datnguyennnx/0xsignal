/** DPO (Detrended Price Oscillator) - Cycle identification with functional patterns */
// DPO = Close - SMA(Close, period)[displaced]

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface DPOResult {
  readonly value: number;
  readonly signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  readonly cycle: "PEAK" | "TROUGH" | "NEUTRAL";
}

// Signal classification based on threshold
const classifySignal = (dpo: number, threshold: number) =>
  Match.value(dpo).pipe(
    Match.when(
      (v) => v > threshold,
      () => "OVERBOUGHT" as const
    ),
    Match.when(
      (v) => v < -threshold,
      () => "OVERSOLD" as const
    ),
    Match.orElse(() => "NEUTRAL" as const)
  );

// Cycle classification
const classifyCycle = Match.type<{ dpo: number; prevDPO: number }>().pipe(
  Match.when(
    ({ dpo, prevDPO }) => dpo > 0 && dpo < prevDPO,
    () => "PEAK" as const
  ),
  Match.when(
    ({ dpo, prevDPO }) => dpo < 0 && dpo > prevDPO,
    () => "TROUGH" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Round to 2 decimal places
const round2 = (n: number): number => Math.round(n * 100) / 100;

// Calculate SMA for a window
const calculateWindowSMA = (arr: ReadonlyArray<number>): number =>
  pipe(
    arr,
    Arr.reduce(0, (a, b) => a + b)
  ) / arr.length;

// Calculate DPO
export const calculateDPO = (closes: ReadonlyArray<number>, period: number = 20): DPOResult => {
  const displacement = Math.floor(period / 2) + 1;

  if (closes.length < period + displacement) {
    return { value: 0, signal: "NEUTRAL", cycle: "NEUTRAL" };
  }

  const displacedIndex = closes.length - displacement;
  const smaWindow = Arr.take(Arr.drop(closes, displacedIndex - period + 1), period);
  const sma = calculateWindowSMA(smaWindow);
  const currentClose = closes[closes.length - 1];
  const dpo = currentClose - sma;
  const threshold = sma * 0.02;

  // Calculate previous DPO for cycle detection
  const cycle: "PEAK" | "TROUGH" | "NEUTRAL" =
    closes.length > displacement + 2
      ? pipe(Arr.take(Arr.drop(closes, displacedIndex - period), period), (prevWindow) => {
          const prevSma = calculateWindowSMA(prevWindow);
          const prevDPO = closes[closes.length - 2] - prevSma;
          return classifyCycle({ dpo, prevDPO });
        })
      : "NEUTRAL";

  return {
    value: round2(dpo),
    signal: classifySignal(dpo, threshold),
    cycle,
  };
};

// Calculate DPO series using Arr.makeBy
export const calculateDPOSeries = (
  closes: ReadonlyArray<number>,
  period: number = 20
): ReadonlyArray<number> => {
  const displacement = Math.floor(period / 2) + 1;
  const startIdx = period + displacement - 1;

  return pipe(
    Arr.makeBy(closes.length - startIdx, (i) => {
      const idx = i + startIdx;
      const displacedIndex = idx - displacement;
      const smaWindow = Arr.take(Arr.drop(closes, displacedIndex - period + 1), period);
      const sma = calculateWindowSMA(smaWindow);
      return closes[idx] - sma;
    })
  );
};

// Effect-based wrapper
export const computeDPO = (
  closes: ReadonlyArray<number>,
  period: number = 20
): Effect.Effect<DPOResult> => Effect.sync(() => calculateDPO(closes, period));

export const DPOMetadata: FormulaMetadata = {
  name: "DPO",
  category: "oscillators",
  difficulty: "intermediate",
  description: "Detrended Price Oscillator - removes trend to identify cycles",
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
