import type { ChartDataPoint } from "../../types/chart";
import type {
  WyckoffPhase,
  WyckoffCycle,
  Climax,
  TradingRange,
  WyckoffEvent,
  EffortResult,
  WyckoffConfig,
  PhaseMarker,
} from "./types";
import {
  calculateATR,
  average,
  getSpread,
  isDownBar,
  isUpBar,
  calculateAverageVolume,
  calculateAverageSpread,
} from "../common";
import { WYCKOFF_TYPES, CYCLE_THRESHOLDS } from "../constants";

export const detectSellingClimax = (
  data: ChartDataPoint[],
  index: number,
  config: WyckoffConfig
): Climax | null => {
  if (index < config.volumeLookback) return null;

  const bar = data[index];
  const lookback = data.slice(index - config.volumeLookback, index);
  const avgVolume = average(lookback.map((b) => b.volume));
  const avgSpread = average(lookback.map(getSpread));

  const isClimax =
    isDownBar(bar) &&
    bar.volume > avgVolume * config.volumeClimaxMultiplier &&
    getSpread(bar) > avgSpread * config.spreadClimaxMultiplier;

  if (!isClimax) return null;

  const prevLows = lookback.map((b) => b.low);
  const isNewLow = bar.low < Math.min(...prevLows);

  if (!isNewLow) return null;

  return {
    type: WYCKOFF_TYPES.CLIMAX.SC,
    time: bar.time,
    price: bar.low,
    volume: bar.volume,
    index,
  };
};

export const detectBuyingClimax = (
  data: ChartDataPoint[],
  index: number,
  config: WyckoffConfig
): Climax | null => {
  if (index < config.volumeLookback) return null;

  const bar = data[index];
  const lookback = data.slice(index - config.volumeLookback, index);
  const avgVolume = average(lookback.map((b) => b.volume));
  const avgSpread = average(lookback.map(getSpread));

  const isClimax =
    isUpBar(bar) &&
    bar.volume > avgVolume * config.volumeClimaxMultiplier &&
    getSpread(bar) > avgSpread * config.spreadClimaxMultiplier;

  if (!isClimax) return null;

  const prevHighs = lookback.map((b) => b.high);
  const isNewHigh = bar.high > Math.max(...prevHighs);

  if (!isNewHigh) return null;

  return {
    type: WYCKOFF_TYPES.CLIMAX.BC,
    time: bar.time,
    price: bar.high,
    volume: bar.volume,
    index,
  };
};

export const detectTradingRange = (
  data: ChartDataPoint[],
  startIndex: number,
  endIndex: number
): TradingRange | null => {
  if (endIndex - startIndex < 5) return null;

  const rangeBars = data.slice(startIndex, endIndex + 1);
  const high = Math.max(...rangeBars.map((b) => b.high));
  const low = Math.min(...rangeBars.map((b) => b.low));

  return {
    startTime: data[startIndex].time,
    endTime: data[endIndex].time,
    high,
    low,
    midpoint: (high + low) / 2,
  };
};

export const determineCycle = (climaxes: Climax[], data: ChartDataPoint[]): WyckoffCycle => {
  if (climaxes.length === 0) return WYCKOFF_TYPES.CYCLE.UNKNOWN;

  const lastClimax = climaxes[climaxes.length - 1];
  const recentBars = data.slice(lastClimax.index);

  if (recentBars.length < 5) return WYCKOFF_TYPES.CYCLE.UNKNOWN;

  const firstPrice = recentBars[0].close;
  const lastPrice = recentBars[recentBars.length - 1].close;
  const priceChange = (lastPrice - firstPrice) / firstPrice;

  if (lastClimax.type === WYCKOFF_TYPES.CLIMAX.SC) {
    if (priceChange > CYCLE_THRESHOLDS.PRICE_CHANGE_PERCENT) return WYCKOFF_TYPES.CYCLE.MARKUP;
    return WYCKOFF_TYPES.CYCLE.ACCUMULATION;
  } else {
    if (priceChange < -CYCLE_THRESHOLDS.PRICE_CHANGE_PERCENT) return WYCKOFF_TYPES.CYCLE.MARKDOWN;
    return WYCKOFF_TYPES.CYCLE.DISTRIBUTION;
  }
};

export const determinePhase = (events: WyckoffEvent[], climaxes: Climax[]): WyckoffPhase | null => {
  if (events.length > 0) {
    const lastEvent = events[events.length - 1];
    if (lastEvent.type === WYCKOFF_TYPES.EVENT.ST) return WYCKOFF_TYPES.PHASE.A;
    else if (
      lastEvent.type === WYCKOFF_TYPES.EVENT.SPRING ||
      lastEvent.type === WYCKOFF_TYPES.EVENT.UPTHRUST
    )
      return WYCKOFF_TYPES.PHASE.C;
    else if (
      lastEvent.type === WYCKOFF_TYPES.EVENT.LPS ||
      lastEvent.type === WYCKOFF_TYPES.EVENT.LPSY ||
      lastEvent.type === WYCKOFF_TYPES.EVENT.SOS ||
      lastEvent.type === WYCKOFF_TYPES.EVENT.SOW
    )
      return WYCKOFF_TYPES.PHASE.D;
  } else if (climaxes.length > 0) {
    return WYCKOFF_TYPES.PHASE.A;
  }
  return null;
};

export const buildPhaseMarkers = (
  cycle: WyckoffCycle,
  climaxes: Climax[],
  events: WyckoffEvent[]
): PhaseMarker[] => {
  const markers: PhaseMarker[] = [];

  if (climaxes.length === 0) return markers;

  const lastClimax = climaxes[climaxes.length - 1];

  markers.push({
    phase: WYCKOFF_TYPES.PHASE.A,
    cycle,
    startTime: climaxes[0].time,
    endTime: lastClimax.time,
    startIndex: climaxes[0].index,
    endIndex: lastClimax.index,
  });

  const phaseEvents = events.filter(
    (e) =>
      e.type === WYCKOFF_TYPES.EVENT.ST ||
      e.type === WYCKOFF_TYPES.EVENT.SPRING ||
      e.type === WYCKOFF_TYPES.EVENT.UPTHRUST ||
      e.type === WYCKOFF_TYPES.EVENT.LPS ||
      e.type === WYCKOFF_TYPES.EVENT.SOS
  );

  if (phaseEvents.length > 0) {
    const lastPhaseEvent = phaseEvents[phaseEvents.length - 1];
    const stEvents = events.filter((e) => e.type === WYCKOFF_TYPES.EVENT.ST);

    if (stEvents.length > 0) {
      const lastST = stEvents[stEvents.length - 1];
      markers.push({
        phase: WYCKOFF_TYPES.PHASE.B,
        cycle,
        startTime: lastClimax.time,
        endTime: lastST.time,
        startIndex: lastClimax.index,
        endIndex: lastST.index,
      });
    }

    markers.push({
      phase: WYCKOFF_TYPES.PHASE.C,
      cycle,
      startTime: stEvents.length > 0 ? stEvents[stEvents.length - 1].time : lastClimax.time,
      endTime: lastPhaseEvent.time,
      startIndex: stEvents.length > 0 ? stEvents[stEvents.length - 1].index : lastClimax.index,
      endIndex: lastPhaseEvent.index,
    });

    markers.push({
      phase: WYCKOFF_TYPES.PHASE.D,
      cycle,
      startTime: lastPhaseEvent.time,
      endTime: Date.now(),
      startIndex: lastPhaseEvent.index,
      endIndex: events.length - 1,
    });
  }

  return markers;
};
