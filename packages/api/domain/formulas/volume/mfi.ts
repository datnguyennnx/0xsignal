/** MFI (Money Flow Index) - Volume-Weighted RSI */
// MFI = 100 - (100 / (1 + Money Flow Ratio)), uses typical price × volume

import { Effect, Match, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface MFIResult {
  readonly value: number;
  readonly signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  readonly moneyFlowRatio: number;
}

// Signal classification
const classifySignal = Match.type<number>().pipe(
  Match.when(
    (m) => m > 80,
    () => "OVERBOUGHT" as const
  ),
  Match.when(
    (m) => m < 20,
    () => "OVERSOLD" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Typical price
const typicalPrice = (high: number, low: number, close: number): number => (high + low + close) / 3;

// Money flow contribution based on price direction
const flowContribution = (
  currTP: number,
  prevTP: number,
  rawMF: number
): { positive: number; negative: number } =>
  pipe(
    Match.value(currTP - prevTP),
    Match.when(
      (d) => d > 0,
      () => ({ positive: rawMF, negative: 0 })
    ),
    Match.when(
      (d) => d < 0,
      () => ({ positive: 0, negative: rawMF })
    ),
    Match.orElse(() => ({ positive: 0, negative: 0 }))
  );

// Calculate MFI
export const calculateMFI = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 14
): MFIResult => {
  const tpSeries = closes.map((c, i) => typicalPrice(highs[i], lows[i], c));
  const rawMF = tpSeries.map((tp, i) => tp * volumes[i]);

  const startIdx = Math.max(1, closes.length - period);
  const { positiveFlow, negativeFlow } = Array.from(
    { length: closes.length - startIdx },
    (_, i) => i + startIdx
  ).reduce(
    (acc, i) => {
      const { positive, negative } = flowContribution(tpSeries[i], tpSeries[i - 1], rawMF[i]);
      return {
        positiveFlow: acc.positiveFlow + positive,
        negativeFlow: acc.negativeFlow + negative,
      };
    },
    { positiveFlow: 0, negativeFlow: 0 }
  );

  const moneyFlowRatio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
  const mfi = 100 - 100 / (1 + moneyFlowRatio);

  return {
    value: Math.round(mfi * 100) / 100,
    signal: classifySignal(mfi),
    moneyFlowRatio: Math.round(moneyFlowRatio * 100) / 100,
  };
};

// Calculate MFI series
export const calculateMFISeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 14
): ReadonlyArray<number> => {
  const tpSeries = closes.map((c, i) => typicalPrice(highs[i], lows[i], c));
  const rawMF = tpSeries.map((tp, i) => tp * volumes[i]);

  return Array.from({ length: closes.length - period }, (_, idx) => {
    const i = idx + period;
    const { positiveFlow, negativeFlow } = Array.from(
      { length: period },
      (_, j) => i - period + 1 + j
    ).reduce(
      (acc, k) => {
        const { positive, negative } = flowContribution(tpSeries[k], tpSeries[k - 1], rawMF[k]);
        return {
          positiveFlow: acc.positiveFlow + positive,
          negativeFlow: acc.negativeFlow + negative,
        };
      },
      { positiveFlow: 0, negativeFlow: 0 }
    );
    const ratio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
    return 100 - 100 / (1 + ratio);
  });
};

// Effect-based wrapper
export const computeMFI = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  volumes: ReadonlyArray<number>,
  period: number = 14
): Effect.Effect<MFIResult> =>
  Effect.sync(() => calculateMFI(highs, lows, closes, volumes, period));

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
