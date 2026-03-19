import type { ChartDataPoint } from "../../types/chart";
import type {
  SwingPoint,
  MarketStructure,
  StructureEvent,
  TrendDirection,
  SwingType,
} from "./types";
import { calculateATR } from "../common";
import { ICT_TYPES, DIRECTION, SWING_TYPE, type SwingTypeLevel } from "../constants";

export const detectSwingHighs = (data: ChartDataPoint[], lookback: number): SwingPoint[] => {
  const swings: SwingPoint[] = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    const curr = data[i];
    const prev = data[i - 1];
    const next = data[i + 1];

    let isHigh = curr.high > prev.high && curr.high > next.high;

    for (let j = 1; j <= lookback; j++) {
      if (data[i - j].high >= curr.high || data[i + j].high >= curr.high) {
        isHigh = false;
        break;
      }
    }

    if (isHigh) {
      swings.push({
        time: curr.time,
        price: curr.high,
        type: ICT_TYPES.SWING.HH,
        index: i,
      });
    }
  }

  return swings;
};

export const detectSwingLows = (data: ChartDataPoint[], lookback: number): SwingPoint[] => {
  const swings: SwingPoint[] = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    const curr = data[i];
    const prev = data[i - 1];
    const next = data[i + 1];

    let isLow = curr.low < prev.low && curr.low < next.low;

    for (let j = 1; j <= lookback; j++) {
      if (data[i - j].low <= curr.low || data[i + j].low <= curr.low) {
        isLow = false;
        break;
      }
    }

    if (isLow) {
      swings.push({
        time: curr.time,
        price: curr.low,
        type: ICT_TYPES.SWING.HL,
        index: i,
      });
    }
  }

  return swings;
};

export const classifySwings = (highs: SwingPoint[], lows: SwingPoint[]): SwingPoint[] => {
  const allSwings: SwingPoint[] = [...highs, ...lows].sort((a, b) => a.time - b.time);
  const classified: SwingPoint[] = [];

  for (let i = 0; i < allSwings.length; i++) {
    const swing = allSwings[i];
    const prev = classified[classified.length - 1];

    let swingType: SwingType;

    if (swing.type === ICT_TYPES.SWING.HH) {
      if (!prev || prev.type === ICT_TYPES.SWING.LL || prev.type === ICT_TYPES.SWING.LH) {
        swingType = ICT_TYPES.SWING.HH;
      } else {
        swingType = ICT_TYPES.SWING.LH;
      }
    } else {
      if (!prev || prev.type === ICT_TYPES.SWING.HL || prev.type === ICT_TYPES.SWING.HH) {
        swingType = ICT_TYPES.SWING.HL;
      } else {
        swingType = ICT_TYPES.SWING.LL;
      }
    }

    classified.push({ ...swing, type: swingType });
  }

  return classified;
};

export const detectMarketStructure = (
  data: ChartDataPoint[],
  lookback: number = 3
): MarketStructure => {
  const highs = detectSwingHighs(data, lookback);
  const lows = detectSwingLows(data, lookback);
  const swings = classifySwings(highs, lows);

  const events: StructureEvent[] = [];
  let trend: TrendDirection = DIRECTION.NEUTRAL;

  for (let i = 0; i < swings.length; i++) {
    const swing = swings[i];

    if (swing.type === ICT_TYPES.SWING.HH) {
      trend = DIRECTION.BULLISH;
    } else if (swing.type === ICT_TYPES.SWING.LL) {
      trend = DIRECTION.BEARISH;
    }
  }

  for (let i = 1; i < swings.length; i++) {
    const curr = swings[i];

    if (trend === DIRECTION.BULLISH && curr.type === ICT_TYPES.SWING.HH) {
      events.push({
        time: curr.time,
        price: curr.price,
        type: ICT_TYPES.STRUCTURE.BOS,
        direction: DIRECTION.BULLISH,
        index: curr.index,
      });
    } else if (trend === DIRECTION.BEARISH && curr.type === ICT_TYPES.SWING.LL) {
      events.push({
        time: curr.time,
        price: curr.price,
        type: ICT_TYPES.STRUCTURE.BOS,
        direction: DIRECTION.BEARISH,
        index: curr.index,
      });
    }

    if (trend === DIRECTION.BULLISH && curr.type === ICT_TYPES.SWING.LL) {
      events.push({
        time: curr.time,
        price: curr.price,
        type: ICT_TYPES.STRUCTURE.CHOCH,
        direction: DIRECTION.BEARISH,
        index: curr.index,
      });
      trend = DIRECTION.BEARISH;
    } else if (trend === DIRECTION.BEARISH && curr.type === ICT_TYPES.SWING.HH) {
      events.push({
        time: curr.time,
        price: curr.price,
        type: ICT_TYPES.STRUCTURE.CHOCH,
        direction: DIRECTION.BULLISH,
        index: curr.index,
      });
      trend = DIRECTION.BULLISH;
    }
  }

  return { swings, events, currentTrend: trend };
};

export const getCurrentTrend = (structure: MarketStructure): TrendDirection => {
  return structure.currentTrend;
};

export const getLastSwing = (
  structure: MarketStructure,
  type?: SwingTypeLevel
): SwingPoint | null => {
  const swings = structure.swings;
  if (swings.length === 0) return null;

  const last = swings[swings.length - 1];
  if (type === SWING_TYPE.HIGH) {
    for (let i = swings.length - 1; i >= 0; i--) {
      if (swings[i].type === ICT_TYPES.SWING.HH || swings[i].type === ICT_TYPES.SWING.LH)
        return swings[i];
    }
  } else if (type === SWING_TYPE.LOW) {
    for (let i = swings.length - 1; i >= 0; i--) {
      if (swings[i].type === ICT_TYPES.SWING.HL || swings[i].type === ICT_TYPES.SWING.LL)
        return swings[i];
    }
  }
  return last;
};
