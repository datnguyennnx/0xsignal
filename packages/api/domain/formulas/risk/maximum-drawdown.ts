/** Maximum Drawdown - Peak-to-Trough Decline */
// MDD = (Trough - Peak) / Peak

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface MaximumDrawdownResult {
  readonly value: number;
  readonly peakIndex: number;
  readonly troughIndex: number;
  readonly duration: number;
  readonly severity: "NONE" | "MILD" | "MODERATE" | "SIGNIFICANT" | "SEVERE";
}

// Severity classification
const classifySeverity = Match.type<number>().pipe(
  Match.when(
    (d) => d < 0.05,
    () => "NONE" as const
  ),
  Match.when(
    (d) => d < 0.1,
    () => "MILD" as const
  ),
  Match.when(
    (d) => d < 0.2,
    () => "MODERATE" as const
  ),
  Match.when(
    (d) => d < 0.5,
    () => "SIGNIFICANT" as const
  ),
  Match.orElse(() => "SEVERE" as const)
);

// Calculate Maximum Drawdown
export const calculateMaximumDrawdown = (values: ReadonlyArray<number>): MaximumDrawdownResult => {
  const result = values.reduce(
    (acc, value, i) => {
      const newPeak = value > acc.peak;
      const peak = newPeak ? value : acc.peak;
      const peakIdx = newPeak ? i : acc.peakIdx;
      const drawdown = (value - peak) / peak;
      const isNewMax = drawdown < acc.maxDrawdown;

      return {
        peak,
        peakIdx,
        maxDrawdown: isNewMax ? drawdown : acc.maxDrawdown,
        peakIndex: isNewMax ? peakIdx : acc.peakIndex,
        troughIndex: isNewMax ? i : acc.troughIndex,
      };
    },
    {
      peak: values[0],
      peakIdx: 0,
      maxDrawdown: 0,
      peakIndex: 0,
      troughIndex: 0,
    }
  );

  return {
    value: Math.round(result.maxDrawdown * 10000) / 100,
    peakIndex: result.peakIndex,
    troughIndex: result.troughIndex,
    duration: result.troughIndex - result.peakIndex,
    severity: classifySeverity(Math.abs(result.maxDrawdown)),
  };
};

// Effect-based wrapper
export const computeMaximumDrawdown = (
  values: ReadonlyArray<number>
): Effect.Effect<MaximumDrawdownResult> => Effect.sync(() => calculateMaximumDrawdown(values));

export const MaximumDrawdownMetadata: FormulaMetadata = {
  name: "MaximumDrawdown",
  category: "risk",
  difficulty: "advanced",
  description: "Maximum Drawdown - largest peak-to-trough decline",
  requiredInputs: ["values"],
  optionalInputs: [],
  minimumDataPoints: 2,
  outputType: "MaximumDrawdownResult",
  useCases: [
    "risk assessment",
    "downside risk measurement",
    "strategy evaluation",
    "capital preservation",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
