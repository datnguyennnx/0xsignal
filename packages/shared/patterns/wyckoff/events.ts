import type { ChartDataPoint } from "../../types/chart";
import type { WyckoffEvent, WyckoffConfig } from "./types";
import { calculateATR, average, isUpBar, isDownBar } from "../common";
import {
  WYCKOFF_TYPES,
  SIGNIFICANCE,
  VOLUME_THRESHOLDS,
  CYCLE_THRESHOLDS,
  type SignificanceLevel,
} from "../constants";

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
    type: WYCKOFF_TYPES.EVENT.SPRING,
    time: bar.time,
    price: bar.low,
    index,
    significance:
      bar.volume < avgVolume * VOLUME_THRESHOLDS.VERY_LOW ? SIGNIFICANCE.HIGH : SIGNIFICANCE.MEDIUM,
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
    type: WYCKOFF_TYPES.EVENT.UPTHRUST,
    time: bar.time,
    price: bar.high,
    index,
    significance:
      bar.volume < avgVolume * VOLUME_THRESHOLDS.VERY_LOW ? SIGNIFICANCE.HIGH : SIGNIFICANCE.MEDIUM,
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

  const tolerance =
    calculateATR(data.slice(0, index + 1), config.atrPeriod) * VOLUME_THRESHOLDS.LOW;

  if (isAccumulation) {
    const isTest =
      Math.abs(bar.low - climaxPrice) < tolerance &&
      bar.volume < avgVolume * VOLUME_THRESHOLDS.HIGH;

    if (!isTest) return null;

    return {
      type: WYCKOFF_TYPES.EVENT.ST,
      time: bar.time,
      price: bar.low,
      index,
      significance:
        bar.volume < avgVolume * VOLUME_THRESHOLDS.LOW ? SIGNIFICANCE.HIGH : SIGNIFICANCE.MEDIUM,
    };
  } else {
    const isTest =
      Math.abs(bar.high - climaxPrice) < tolerance &&
      bar.volume < avgVolume * VOLUME_THRESHOLDS.HIGH;

    if (!isTest) return null;

    return {
      type: WYCKOFF_TYPES.EVENT.ST,
      time: bar.time,
      price: bar.high,
      index,
      significance:
        bar.volume < avgVolume * VOLUME_THRESHOLDS.LOW ? SIGNIFICANCE.HIGH : SIGNIFICANCE.MEDIUM,
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

  const tolerance =
    calculateATR(data.slice(0, index + 1), config.atrPeriod) * CYCLE_THRESHOLDS.ATR_TOLERANCE;

  const isLPS =
    bar.low >= supportLevel - tolerance &&
    bar.low <= supportLevel + tolerance &&
    bar.volume < avgVolume * VOLUME_THRESHOLDS.MEDIUM &&
    isUpBar(bar) &&
    prev1.low < prev2.low;

  if (!isLPS) return null;

  return {
    type: WYCKOFF_TYPES.EVENT.LPS,
    time: bar.time,
    price: bar.low,
    index,
    significance: SIGNIFICANCE.HIGH,
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

  const tolerance =
    calculateATR(data.slice(0, index + 1), config.atrPeriod) * CYCLE_THRESHOLDS.ATR_TOLERANCE;

  const isLPSY =
    bar.high >= resistanceLevel - tolerance &&
    bar.high <= resistanceLevel + tolerance &&
    bar.volume < avgVolume * VOLUME_THRESHOLDS.MEDIUM &&
    isDownBar(bar) &&
    prev1.high > prev2.high;

  if (!isLPSY) return null;

  return {
    type: WYCKOFF_TYPES.EVENT.LPSY,
    time: bar.time,
    price: bar.high,
    index,
    significance: SIGNIFICANCE.HIGH,
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

  const isSOS =
    bar.close > resistanceLevel &&
    isUpBar(bar) &&
    bar.volume > avgVolume * VOLUME_THRESHOLDS.VERY_HIGH;

  if (!isSOS) return null;

  return {
    type: WYCKOFF_TYPES.EVENT.SOS,
    time: bar.time,
    price: bar.close,
    index,
    significance:
      bar.volume > avgVolume * VOLUME_THRESHOLDS.EXTREME ? SIGNIFICANCE.HIGH : SIGNIFICANCE.MEDIUM,
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

  const isSOW =
    bar.close < supportLevel &&
    isDownBar(bar) &&
    bar.volume > avgVolume * VOLUME_THRESHOLDS.VERY_HIGH;

  if (!isSOW) return null;

  return {
    type: WYCKOFF_TYPES.EVENT.SOW,
    time: bar.time,
    price: bar.close,
    index,
    significance:
      bar.volume > avgVolume * VOLUME_THRESHOLDS.EXTREME ? SIGNIFICANCE.HIGH : SIGNIFICANCE.MEDIUM,
  };
};

export const getSignificantEvents = (
  events: WyckoffEvent[],
  significance: SignificanceLevel
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
