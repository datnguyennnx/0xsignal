import type { ChartDataPoint } from "../../types/chart";
import type {
  SwingPoint,
  StructureEvent,
  MarketStructure,
  SwingType,
  TrendDirection,
} from "./types";
import { isSwingHigh, isSwingLow } from "../common";

interface RawSwing {
  index: number;
  price: number;
  isHigh: boolean;
  time: number;
}

export const detectRawSwings = (data: ChartDataPoint[], lookback: number): RawSwing[] => {
  const swings: RawSwing[] = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    if (isSwingHigh(data, i, lookback)) {
      swings.push({ index: i, price: data[i].high, isHigh: true, time: data[i].time });
    }
    if (isSwingLow(data, i, lookback)) {
      swings.push({ index: i, price: data[i].low, isHigh: false, time: data[i].time });
    }
  }

  swings.sort((a, b) => a.index - b.index);
  const filtered: RawSwing[] = [];
  for (const swing of swings) {
    const last = filtered[filtered.length - 1];
    if (!last || last.isHigh !== swing.isHigh) {
      filtered.push(swing);
    } else if (swing.isHigh && swing.price > last.price) {
      filtered[filtered.length - 1] = swing;
    } else if (!swing.isHigh && swing.price < last.price) {
      filtered[filtered.length - 1] = swing;
    }
  }

  return filtered;
};

export const detectMarketStructure = (
  data: ChartDataPoint[],
  lookback: number
): MarketStructure => {
  const rawSwings = detectRawSwings(data, lookback);
  if (rawSwings.length < 4) {
    return { swings: [], events: [], currentTrend: "neutral" };
  }

  const swings: SwingPoint[] = [];
  const events: StructureEvent[] = [];
  let lastHighSwing: RawSwing | null = null;
  let lastLowSwing: RawSwing | null = null;
  let trend: TrendDirection = "neutral";

  for (const swing of rawSwings) {
    let swingType: SwingType;

    if (swing.isHigh) {
      swingType = !lastHighSwing || swing.price > lastHighSwing.price ? "HH" : "LH";
      lastHighSwing = swing;
    } else {
      swingType = !lastLowSwing || swing.price > lastLowSwing.price ? "HL" : "LL";
      lastLowSwing = swing;
    }

    swings.push({
      time: swing.time,
      price: swing.price,
      type: swingType,
      index: swing.index,
    });

    if (swings.length >= 3) {
      const curr = swings[swings.length - 1];

      if (trend === "bullish" && curr.type === "HH") {
        events.push({
          time: curr.time,
          price: curr.price,
          type: "BOS",
          direction: "bullish",
          index: curr.index,
        });
      } else if (trend === "bearish" && curr.type === "LL") {
        events.push({
          time: curr.time,
          price: curr.price,
          type: "BOS",
          direction: "bearish",
          index: curr.index,
        });
      }

      if (trend === "bullish" && curr.type === "LL") {
        events.push({
          time: curr.time,
          price: curr.price,
          type: "ChoCH",
          direction: "bearish",
          index: curr.index,
        });
        trend = "bearish";
      } else if (trend === "bearish" && curr.type === "HH") {
        events.push({
          time: curr.time,
          price: curr.price,
          type: "ChoCH",
          direction: "bullish",
          index: curr.index,
        });
        trend = "bullish";
      }

      if (trend === "neutral") {
        const prev = swings[swings.length - 2];
        if (curr.type === "HH" && prev.type === "HL") trend = "bullish";
        else if (curr.type === "LL" && prev.type === "LH") trend = "bearish";
      }
    }
  }

  return { swings, events, currentTrend: trend };
};

export const getCurrentTrend = (structure: MarketStructure): TrendDirection => {
  return structure.currentTrend;
};

export const getLastSwing = (
  structure: MarketStructure,
  type?: "high" | "low"
): SwingPoint | null => {
  const swings = structure.swings;
  if (swings.length === 0) return null;

  const last = swings[swings.length - 1];
  if (type === "high") {
    for (let i = swings.length - 1; i >= 0; i--) {
      if (swings[i].type === "HH" || swings[i].type === "LH") return swings[i];
    }
  } else if (type === "low") {
    for (let i = swings.length - 1; i >= 0; i--) {
      if (swings[i].type === "HL" || swings[i].type === "LL") return swings[i];
    }
  }

  return last;
};

export const getRecentStructureEvents = (
  structure: MarketStructure,
  count: number = 3
): StructureEvent[] => {
  return structure.events.slice(-count);
};
