import type { ChartDataPoint } from "../../types/chart";
import type { EffortResult } from "./types";
import { average, getSpread, isDownBar, isUpBar } from "../common";
import { WYCKOFF_TYPES, DIVERGENCE_THRESHOLDS } from "../constants";

export const calculateEffortResult = (
  data: ChartDataPoint[],
  index: number,
  lookback: number = 5
): EffortResult | null => {
  if (index < lookback) return null;

  const bar = data[index];
  const prevBars = data.slice(index - lookback, index);
  const avgVolume = average(prevBars.map((b) => b.volume));
  const avgSpread = average(prevBars.map(getSpread));

  const effort = bar.volume / avgVolume;
  const result = getSpread(bar) / avgSpread;

  let divergence: (typeof WYCKOFF_TYPES.DIVERGENCE)[keyof typeof WYCKOFF_TYPES.DIVERGENCE] =
    WYCKOFF_TYPES.DIVERGENCE.NEUTRAL;

  if (effort > DIVERGENCE_THRESHOLDS.EFFORT_HIGH && result < DIVERGENCE_THRESHOLDS.RESULT_LOW) {
    divergence = isDownBar(bar)
      ? WYCKOFF_TYPES.DIVERGENCE.BULLISH
      : WYCKOFF_TYPES.DIVERGENCE.BEARISH;
  } else if (
    effort < DIVERGENCE_THRESHOLDS.EFFORT_LOW &&
    result > DIVERGENCE_THRESHOLDS.RESULT_HIGH
  ) {
    divergence = isUpBar(bar) ? WYCKOFF_TYPES.DIVERGENCE.BULLISH : WYCKOFF_TYPES.DIVERGENCE.BEARISH;
  }

  return {
    time: bar.time,
    effort,
    result,
    divergence,
    index,
  };
};
export const getBullishDivergences = (effortResults: EffortResult[]): EffortResult[] => {
  return effortResults.filter((er) => er.divergence === WYCKOFF_TYPES.DIVERGENCE.BULLISH);
};

export const getBearishDivergences = (effortResults: EffortResult[]): EffortResult[] => {
  return effortResults.filter((er) => er.divergence === WYCKOFF_TYPES.DIVERGENCE.BEARISH);
};

export const getLastDivergence = (effortResults: EffortResult[]): EffortResult | null => {
  const divergences = effortResults.filter(
    (er) => er.divergence !== WYCKOFF_TYPES.DIVERGENCE.NEUTRAL
  );
  if (divergences.length === 0) return null;
  return divergences[divergences.length - 1];
};

export const isStrongDivergence = (effortResult: EffortResult): boolean => {
  return (
    (effortResult.effort > DIVERGENCE_THRESHOLDS.STRONG_EFFORT &&
      effortResult.result < DIVERGENCE_THRESHOLDS.STRONG_RESULT) ||
    (effortResult.effort < DIVERGENCE_THRESHOLDS.STRONG_REVERSE_EFFORT &&
      effortResult.result > DIVERGENCE_THRESHOLDS.STRONG_REVERSE_RESULT)
  );
};
