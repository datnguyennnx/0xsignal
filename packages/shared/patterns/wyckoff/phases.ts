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
    type: "SC",
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
    type: "BC",
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
  if (climaxes.length === 0) return "unknown";

  const lastClimax = climaxes[climaxes.length - 1];
  const recentBars = data.slice(lastClimax.index);

  if (recentBars.length < 5) return "unknown";

  const firstPrice = recentBars[0].close;
  const lastPrice = recentBars[recentBars.length - 1].close;
  const priceChange = (lastPrice - firstPrice) / firstPrice;

  if (lastClimax.type === "SC") {
    if (priceChange > 0.05) return "markup";
    return "accumulation";
  } else {
    if (priceChange < -0.05) return "markdown";
    return "distribution";
  }
};

export const determinePhase = (events: WyckoffEvent[], climaxes: Climax[]): WyckoffPhase | null => {
  if (events.length > 0) {
    const lastEvent = events[events.length - 1];
    if (lastEvent.type === "ST") return "A";
    else if (lastEvent.type === "spring" || lastEvent.type === "upthrust") return "C";
    else if (
      lastEvent.type === "LPS" ||
      lastEvent.type === "LPSY" ||
      lastEvent.type === "SOS" ||
      lastEvent.type === "SOW"
    )
      return "D";
  } else if (climaxes.length > 0) {
    return "A";
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

  // Phase A: Initial climax
  markers.push({
    phase: "A",
    cycle,
    startTime: climaxes[0].time,
    endTime: lastClimax.time,
    startIndex: climaxes[0].index,
    endIndex: lastClimax.index,
  });

  // Find phase markers based on events
  const phaseEvents = events.filter(
    (e) =>
      e.type === "ST" ||
      e.type === "spring" ||
      e.type === "upthrust" ||
      e.type === "LPS" ||
      e.type === "SOS"
  );

  if (phaseEvents.length > 0) {
    const lastPhaseEvent = phaseEvents[phaseEvents.length - 1];
    const stEvents = events.filter((e) => e.type === "ST");

    // Phase B: Testing (ST events)
    if (stEvents.length > 0) {
      const lastST = stEvents[stEvents.length - 1];
      markers.push({
        phase: "B",
        cycle,
        startTime: lastClimax.time,
        endTime: lastST.time,
        startIndex: lastClimax.index,
        endIndex: lastST.index,
      });
    }

    // Phase C: Spring/Upthrust
    markers.push({
      phase: "C",
      cycle,
      startTime: stEvents.length > 0 ? stEvents[stEvents.length - 1].time : lastClimax.time,
      endTime: lastPhaseEvent.time,
      startIndex: stEvents.length > 0 ? stEvents[stEvents.length - 1].index : lastClimax.index,
      endIndex: lastPhaseEvent.index,
    });

    // Phase D: Last point of supply/demand
    markers.push({
      phase: "D",
      cycle,
      startTime: lastPhaseEvent.time,
      endTime: Date.now(),
      startIndex: lastPhaseEvent.index,
      endIndex: events.length - 1,
    });
  }

  return markers;
};
