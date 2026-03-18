import type { ChartDataPoint } from "../../types/chart";
import type { EffortResult } from "./types";
import { average, getSpread, isDownBar, isUpBar } from "../common";

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

  let divergence: "bullish" | "bearish" | "neutral" = "neutral";

  if (effort > 1.5 && result < 0.5) {
    divergence = isDownBar(bar) ? "bullish" : "bearish";
  } else if (effort < 0.5 && result > 1.5) {
    divergence = isUpBar(bar) ? "bullish" : "bearish";
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
  return effortResults.filter((er) => er.divergence === "bullish");
};

export const getBearishDivergences = (effortResults: EffortResult[]): EffortResult[] => {
  return effortResults.filter((er) => er.divergence === "bearish");
};

export const getLastDivergence = (effortResults: EffortResult[]): EffortResult | null => {
  const divergences = effortResults.filter((er) => er.divergence !== "neutral");
  if (divergences.length === 0) return null;
  return divergences[divergences.length - 1];
};

export const isStrongDivergence = (effortResult: EffortResult): boolean => {
  return (
    (effortResult.effort > 2.0 && effortResult.result < 0.3) ||
    (effortResult.effort < 0.3 && effortResult.result > 2.0)
  );
};
