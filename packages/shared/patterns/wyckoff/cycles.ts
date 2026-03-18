import type { ChartDataPoint } from "../../types/chart";
import type { WyckoffCycle, Climax, TradingRange } from "./types";
import { detectTradingRange, determineCycle } from "./phases";

export const identifyCycle = (data: ChartDataPoint[], climaxes: Climax[]): WyckoffCycle => {
  return determineCycle(climaxes, data);
};

export const getCyclePhase = (
  cycle: WyckoffCycle
): "accumulation" | "distribution" | "transition" => {
  switch (cycle) {
    case "accumulation":
    case "markup":
      return "accumulation";
    case "distribution":
    case "markdown":
      return "distribution";
    default:
      return "transition";
  }
};

export const isInAccumulation = (cycle: WyckoffCycle): boolean => {
  return cycle === "accumulation" || cycle === "markup";
};

export const isInDistribution = (cycle: WyckoffCycle): boolean => {
  return cycle === "distribution" || cycle === "markdown";
};

export const getCycleDirection = (cycle: WyckoffCycle): "up" | "down" | "sideways" => {
  switch (cycle) {
    case "markup":
      return "up";
    case "markdown":
      return "down";
    default:
      return "sideways";
  }
};

export const detectCycleTransition = (
  previousCycle: WyckoffCycle,
  currentCycle: WyckoffCycle
): boolean => {
  if (previousCycle === "unknown" || currentCycle === "unknown") return false;
  if (
    (previousCycle === "accumulation" || previousCycle === "markup") &&
    (currentCycle === "distribution" || currentCycle === "markdown")
  ) {
    return true;
  }
  if (
    (previousCycle === "distribution" || previousCycle === "markdown") &&
    (currentCycle === "accumulation" || currentCycle === "markup")
  ) {
    return true;
  }
  return false;
};
