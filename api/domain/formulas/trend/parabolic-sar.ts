/** Parabolic SAR - Stop and reverse trend indicator with functional patterns */
// SAR(n) = SAR(n-1) + AF * (EP - SAR(n-1))

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { FormulaMetadata } from "../core/types";

export interface ParabolicSARResult {
  readonly sar: number;
  readonly trend: "BULLISH" | "BEARISH";
  readonly isReversal: boolean;
  readonly af: number;
  readonly ep: number;
}

// Immutable SAR state
interface SARState {
  readonly sar: number;
  readonly trend: "BULLISH" | "BEARISH";
  readonly ep: number;
  readonly af: number;
  readonly isReversal: boolean;
}

// Round helpers
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round3 = (n: number): number => Math.round(n * 1000) / 1000;

// Initial trend detection
const detectInitialTrend = (closes: ReadonlyArray<number>): "BULLISH" | "BEARISH" =>
  closes[1] > closes[0] ? "BULLISH" : "BEARISH";

// Create initial SAR state
const createInitialState = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  afStart: number
): SARState => {
  const trend = detectInitialTrend(closes);
  return {
    sar: Match.value(trend).pipe(
      Match.when("BULLISH", () => lows[0]),
      Match.orElse(() => highs[0])
    ),
    trend,
    ep: Match.value(trend).pipe(
      Match.when("BULLISH", () => highs[1]),
      Match.orElse(() => lows[1])
    ),
    af: afStart,
    isReversal: false,
  };
};

// Update bullish SAR state
const updateBullishState = (
  state: SARState,
  high: number,
  low: number,
  prevLow: number,
  prevPrevLow: number,
  afStart: number,
  afIncrement: number,
  afMax: number
): SARState => {
  const newSar = Math.min(state.sar + state.af * (state.ep - state.sar), prevLow, prevPrevLow);

  return Match.value(low < newSar).pipe(
    Match.when(true, () => ({
      sar: state.ep,
      trend: "BEARISH" as const,
      ep: low,
      af: afStart,
      isReversal: true,
    })),
    Match.orElse(() => ({
      sar: newSar,
      trend: "BULLISH" as const,
      ep: high > state.ep ? high : state.ep,
      af: high > state.ep ? Math.min(state.af + afIncrement, afMax) : state.af,
      isReversal: false,
    }))
  );
};

// Update bearish SAR state
const updateBearishState = (
  state: SARState,
  high: number,
  low: number,
  prevHigh: number,
  prevPrevHigh: number,
  afStart: number,
  afIncrement: number,
  afMax: number
): SARState => {
  const newSar = Math.max(state.sar + state.af * (state.ep - state.sar), prevHigh, prevPrevHigh);

  return Match.value(high > newSar).pipe(
    Match.when(true, () => ({
      sar: state.ep,
      trend: "BULLISH" as const,
      ep: high,
      af: afStart,
      isReversal: true,
    })),
    Match.orElse(() => ({
      sar: newSar,
      trend: "BEARISH" as const,
      ep: low < state.ep ? low : state.ep,
      af: low < state.ep ? Math.min(state.af + afIncrement, afMax) : state.af,
      isReversal: false,
    }))
  );
};

// Update SAR state for one period using Match
const updateSARState = (
  state: SARState,
  high: number,
  low: number,
  prevLow: number,
  prevHigh: number,
  prevPrevLow: number,
  prevPrevHigh: number,
  afStart: number,
  afIncrement: number,
  afMax: number
): SARState =>
  Match.value(state.trend).pipe(
    Match.when("BULLISH", () =>
      updateBullishState(state, high, low, prevLow, prevPrevLow, afStart, afIncrement, afMax)
    ),
    Match.orElse(() =>
      updateBearishState(state, high, low, prevHigh, prevPrevHigh, afStart, afIncrement, afMax)
    )
  );

// Calculate Parabolic SAR using Arr.reduce
export const calculateParabolicSAR = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  afStart: number = 0.02,
  afIncrement: number = 0.02,
  afMax: number = 0.2
): ParabolicSARResult =>
  Match.value(highs.length < 2).pipe(
    Match.when(true, () => ({
      sar: closes[0],
      trend: "BULLISH" as const,
      isReversal: false,
      af: afStart,
      ep: highs[0],
    })),
    Match.orElse(() => {
      const initial = createInitialState(highs, lows, closes, afStart);
      const indices = Arr.makeBy(closes.length - 2, (i) => i + 2);

      const finalState = pipe(
        indices,
        Arr.reduce(initial, (state, i) =>
          updateSARState(
            state,
            highs[i],
            lows[i],
            lows[i - 1],
            highs[i - 1],
            lows[i - 2],
            highs[i - 2],
            afStart,
            afIncrement,
            afMax
          )
        )
      );

      return {
        sar: round2(finalState.sar),
        trend: finalState.trend,
        isReversal: finalState.isReversal,
        af: round3(finalState.af),
        ep: round2(finalState.ep),
      };
    })
  );

// Calculate SAR series using Arr.scan
export const calculateParabolicSARSeries = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  afStart: number = 0.02,
  afIncrement: number = 0.02,
  afMax: number = 0.2
): ReadonlyArray<{ sar: number; trend: "BULLISH" | "BEARISH" }> =>
  Match.value(highs.length < 2).pipe(
    Match.when(true, () => [] as { sar: number; trend: "BULLISH" | "BEARISH" }[]),
    Match.orElse(() => {
      const initial = createInitialState(highs, lows, closes, afStart);
      const indices = Arr.makeBy(closes.length - 2, (i) => i + 2);

      const states = pipe(
        indices,
        Arr.scan(initial, (state, i) =>
          updateSARState(
            state,
            highs[i],
            lows[i],
            lows[i - 1],
            highs[i - 1],
            lows[i - 2],
            highs[i - 2],
            afStart,
            afIncrement,
            afMax
          )
        )
      );

      return Arr.map(states, (s) => ({ sar: s.sar, trend: s.trend }));
    })
  );

// Effect-based wrapper
export const computeParabolicSAR = (
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  afStart: number = 0.02,
  afIncrement: number = 0.02,
  afMax: number = 0.2
): Effect.Effect<ParabolicSARResult> =>
  Effect.sync(() => calculateParabolicSAR(highs, lows, closes, afStart, afIncrement, afMax));

export const ParabolicSARMetadata: FormulaMetadata = {
  name: "ParabolicSAR",
  category: "trend",
  difficulty: "beginner",
  description: "Parabolic SAR - stop and reverse trend following indicator",
  requiredInputs: ["highs", "lows", "closes"],
  optionalInputs: ["afStart", "afIncrement", "afMax"],
  minimumDataPoints: 3,
  outputType: "ParabolicSARResult",
  useCases: ["trend following", "stop-loss placement", "reversal detection", "entry/exit signals"],
  timeComplexity: "O(n)",
  dependencies: [],
};
