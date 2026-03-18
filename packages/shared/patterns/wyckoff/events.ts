import type { ChartDataPoint } from "../../types/chart";
import type { WyckoffEvent, WyckoffConfig, Climax } from "./types";
import { calculateATR, average, isUpBar, isDownBar, getSpread } from "../common";

export const detectSpring = (
  data: ChartDataPoint[],
  index: number,
  supportLevel: number,
  config: WyckoffConfig
): WyckoffEvent | null => {
  if (index < 2) return null;

  const bar = data[index];
  const prev = data[index - 1];
  const lookback = data.slice(Math.max(0, index - config.volumeLookback), index);
  const avgVolume = average(lookback.map((b) => b.volume));

  const isSpring =
    bar.low < supportLevel &&
    bar.close > supportLevel &&
    bar.volume < avgVolume * config.springVolThreshold &&
    bar.close > prev.close;

  if (!isSpring) return null;

  return {
    type: "spring",
    time: bar.time,
    price: bar.low,
    index,
    significance: bar.volume < avgVolume * 0.3 ? "high" : "medium",
  };
};

export const detectUpthrust = (
  data: ChartDataPoint[],
  index: number,
  resistanceLevel: number,
  config: WyckoffConfig
): WyckoffEvent | null => {
  if (index < 2) return null;

  const bar = data[index];
  const prev = data[index - 1];
  const lookback = data.slice(Math.max(0, index - config.volumeLookback), index);
  const avgVolume = average(lookback.map((b) => b.volume));

  const isUpthrust =
    bar.high > resistanceLevel &&
    bar.close < resistanceLevel &&
    bar.volume < avgVolume * config.springVolThreshold &&
    bar.close < prev.close;

  if (!isUpthrust) return null;

  return {
    type: "upthrust",
    time: bar.time,
    price: bar.high,
    index,
    significance: bar.volume < avgVolume * 0.3 ? "high" : "medium",
  };
};

export const detectSecondaryTest = (
  data: ChartDataPoint[],
  index: number,
  climaxPrice: number,
  climaxIndex: number,
  isAccumulation: boolean,
  config: WyckoffConfig
): WyckoffEvent | null => {
  if (index <= climaxIndex || index - climaxIndex > 20) return null;

  const bar = data[index];
  const lookback = data.slice(Math.max(0, index - config.volumeLookback), index);
  const avgVolume = average(lookback.map((b) => b.volume));

  const tolerance = calculateATR(data.slice(0, index + 1), config.atrPeriod) * 0.5;

  if (isAccumulation) {
    const isTest = Math.abs(bar.low - climaxPrice) < tolerance && bar.volume < avgVolume * 0.8;

    if (!isTest) return null;

    return {
      type: "ST",
      time: bar.time,
      price: bar.low,
      index,
      significance: bar.volume < avgVolume * 0.5 ? "high" : "medium",
    };
  } else {
    const isTest = Math.abs(bar.high - climaxPrice) < tolerance && bar.volume < avgVolume * 0.8;

    if (!isTest) return null;

    return {
      type: "ST",
      time: bar.time,
      price: bar.high,
      index,
      significance: bar.volume < avgVolume * 0.5 ? "high" : "medium",
    };
  }
};

export const detectLPS = (
  data: ChartDataPoint[],
  index: number,
  supportLevel: number,
  config: WyckoffConfig
): WyckoffEvent | null => {
  if (index < 3) return null;

  const bar = data[index];
  const prev1 = data[index - 1];
  const prev2 = data[index - 2];
  const lookback = data.slice(Math.max(0, index - config.volumeLookback), index);
  const avgVolume = average(lookback.map((b) => b.volume));

  const tolerance = calculateATR(data.slice(0, index + 1), config.atrPeriod) * 0.3;

  const isLPS =
    bar.low >= supportLevel - tolerance &&
    bar.low <= supportLevel + tolerance &&
    bar.volume < avgVolume * 0.7 &&
    isUpBar(bar) &&
    prev1.low < prev2.low;

  if (!isLPS) return null;

  return {
    type: "LPS",
    time: bar.time,
    price: bar.low,
    index,
    significance: "high",
  };
};

export const detectLPSY = (
  data: ChartDataPoint[],
  index: number,
  resistanceLevel: number,
  config: WyckoffConfig
): WyckoffEvent | null => {
  if (index < 3) return null;

  const bar = data[index];
  const prev1 = data[index - 1];
  const prev2 = data[index - 2];
  const lookback = data.slice(Math.max(0, index - config.volumeLookback), index);
  const avgVolume = average(lookback.map((b) => b.volume));

  const tolerance = calculateATR(data.slice(0, index + 1), config.atrPeriod) * 0.3;

  const isLPSY =
    bar.high >= resistanceLevel - tolerance &&
    bar.high <= resistanceLevel + tolerance &&
    bar.volume < avgVolume * 0.7 &&
    isDownBar(bar) &&
    prev1.high > prev2.high;

  if (!isLPSY) return null;

  return {
    type: "LPSY",
    time: bar.time,
    price: bar.high,
    index,
    significance: "high",
  };
};

export const detectSOS = (
  data: ChartDataPoint[],
  index: number,
  resistanceLevel: number,
  config: WyckoffConfig
): WyckoffEvent | null => {
  if (index < 2) return null;

  const bar = data[index];
  const lookback = data.slice(Math.max(0, index - config.volumeLookback), index);
  const avgVolume = average(lookback.map((b) => b.volume));

  const isSOS = bar.close > resistanceLevel && isUpBar(bar) && bar.volume > avgVolume * 1.2;

  if (!isSOS) return null;

  return {
    type: "SOS",
    time: bar.time,
    price: bar.close,
    index,
    significance: bar.volume > avgVolume * 1.5 ? "high" : "medium",
  };
};

export const detectSOW = (
  data: ChartDataPoint[],
  index: number,
  supportLevel: number,
  config: WyckoffConfig
): WyckoffEvent | null => {
  if (index < 2) return null;

  const bar = data[index];
  const lookback = data.slice(Math.max(0, index - config.volumeLookback), index);
  const avgVolume = average(lookback.map((b) => b.volume));

  const isSOW = bar.close < supportLevel && isDownBar(bar) && bar.volume > avgVolume * 1.2;

  if (!isSOW) return null;

  return {
    type: "SOW",
    time: bar.time,
    price: bar.close,
    index,
    significance: bar.volume > avgVolume * 1.5 ? "high" : "medium",
  };
};

export const getSignificantEvents = (
  events: WyckoffEvent[],
  significance: "high" | "medium" | "low"
): WyckoffEvent[] => {
  return events.filter((event) => event.significance === significance);
};

export const getLastEvent = (
  events: WyckoffEvent[],
  type?: WyckoffEvent["type"]
): WyckoffEvent | null => {
  if (events.length === 0) return null;
  const last = events[events.length - 1];
  if (type && last.type !== type) return null;
  return last;
};
