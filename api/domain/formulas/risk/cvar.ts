/** CVaR (Conditional Value at Risk) - Expected Shortfall */
// CVaR = E[Loss | Loss > VaR], measures expected loss beyond VaR

import { Effect, Match } from "effect";
import type { FormulaMetadata } from "../core/types";
import { calculateVaR } from "./var";

export interface CVaRResult {
  readonly cvar95: number;
  readonly cvar99: number;
  readonly var95: number;
  readonly var99: number;
  readonly tailRisk: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
}

// Tail risk classification
const classifyTailRisk = Match.type<number>().pipe(
  Match.when(
    (r) => r < 1.2,
    () => "LOW" as const
  ),
  Match.when(
    (r) => r < 1.5,
    () => "MODERATE" as const
  ),
  Match.when(
    (r) => r < 2,
    () => "HIGH" as const
  ),
  Match.orElse(() => "EXTREME" as const)
);

// Safe division
const safeDivide = (num: number, denom: number, fallback: number): number =>
  denom === 0 ? fallback : num / denom;

// Calculate average of values below threshold
const avgBelowThreshold = (values: ReadonlyArray<number>, threshold: number): number => {
  const below = values.filter((v) => v <= threshold);
  return below.length > 0 ? below.reduce((a, b) => a + b, 0) / below.length : threshold;
};

// Calculate CVaR
export const calculateCVaR = (returns: ReadonlyArray<number>): CVaRResult => {
  const varResult = calculateVaR(returns);
  const sortedReturns = [...returns].sort((a, b) => a - b);

  const var95Threshold = varResult.var95 / 100;
  const var99Threshold = varResult.var99 / 100;

  const cvar95 = avgBelowThreshold(sortedReturns, var95Threshold);
  const cvar99 = avgBelowThreshold(sortedReturns, var99Threshold);

  const ratio = Math.abs(safeDivide(cvar95, var95Threshold, 1));

  return {
    cvar95: Math.round(cvar95 * 10000) / 100,
    cvar99: Math.round(cvar99 * 10000) / 100,
    var95: varResult.var95,
    var99: varResult.var99,
    tailRisk: classifyTailRisk(ratio),
  };
};

// Effect-based wrapper
export const computeCVaR = (returns: ReadonlyArray<number>): Effect.Effect<CVaRResult> =>
  Effect.sync(() => calculateCVaR(returns));

export const CVaRMetadata: FormulaMetadata = {
  name: "CVaR",
  category: "risk",
  difficulty: "advanced",
  description: "Conditional VaR - expected loss beyond VaR threshold",
  requiredInputs: ["returns"],
  optionalInputs: [],
  minimumDataPoints: 20,
  outputType: "CVaRResult",
  useCases: [
    "tail risk measurement",
    "extreme loss estimation",
    "capital allocation",
    "risk management",
  ],
  timeComplexity: "O(n log n)",
  dependencies: ["VaR"],
};
