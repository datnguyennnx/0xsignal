import type { ChartDataPoint } from "../../types/chart";
import type { FairValueGap, FVGType } from "./types";
import { DIRECTION } from "../constants";

export const detectFVGs = (data: ChartDataPoint[], minSizePercent: number): FairValueGap[] => {
  const fvgs: FairValueGap[] = [];
  if (data.length < 3) return fvgs;

  const runningMinLow: number[] = new Array(data.length);
  const runningMaxHigh: number[] = new Array(data.length);

  runningMinLow[data.length - 1] = data[data.length - 1].low;
  runningMaxHigh[data.length - 1] = data[data.length - 1].high;

  for (let i = data.length - 2; i >= 0; i--) {
    runningMinLow[i] = Math.min(data[i].low, runningMinLow[i + 1]);
    runningMaxHigh[i] = Math.max(data[i].high, runningMaxHigh[i + 1]);
  }

  for (let i = 2; i < data.length; i++) {
    const c1 = data[i - 2];
    const c3 = data[i];
    const avgPrice = (c1.close + c3.close) / 2;
    const minSize = avgPrice * (minSizePercent / 100);

    if (c1.high < c3.low && c3.low - c1.high >= minSize) {
      const fvgSize = c3.low - c1.high;
      let fillPercent = 0;

      if (i + 1 < data.length) {
        const lowestAfter = runningMinLow[i + 1];
        if (lowestAfter <= c1.high) {
          fillPercent = 100;
        } else if (lowestAfter < c3.low) {
          fillPercent = ((c3.low - lowestAfter) / fvgSize) * 100;
        }
      }

      fvgs.push({
        startTime: c1.time,
        endTime: c3.time,
        type: DIRECTION.BULLISH,
        high: c3.low,
        low: c1.high,
        midpoint: (c3.low + c1.high) / 2,
        filled: fillPercent >= 100,
        fillPercent: Math.min(100, fillPercent),
        index: i,
      });
    }

    if (c1.low > c3.high && c1.low - c3.high >= minSize) {
      const fvgSize = c1.low - c3.high;
      let fillPercent = 0;

      if (i + 1 < data.length) {
        const highestAfter = runningMaxHigh[i + 1];
        if (highestAfter >= c1.low) {
          fillPercent = 100;
        } else if (highestAfter > c3.high) {
          fillPercent = ((highestAfter - c3.high) / fvgSize) * 100;
        }
      }

      fvgs.push({
        startTime: c1.time,
        endTime: c3.time,
        type: DIRECTION.BEARISH,
        high: c1.low,
        low: c3.high,
        midpoint: (c1.low + c3.high) / 2,
        filled: fillPercent >= 100,
        fillPercent: Math.min(100, fillPercent),
        index: i,
      });
    }
  }

  return fvgs;
};

export const getUnfilledFVGs = (fvgs: FairValueGap[]): FairValueGap[] => {
  return fvgs.filter((fvg) => !fvg.filled);
};

export const getRecentFVGs = (
  fvgs: FairValueGap[],
  count: number,
  type?: FVGType
): FairValueGap[] => {
  let filtered = fvgs;
  if (type) {
    filtered = fvgs.filter((fvg) => fvg.type === type);
  }
  return filtered.slice(-count);
};

export const getActiveFVG = (
  fvgs: FairValueGap[],
  currentPrice: number,
  type: FVGType
): FairValueGap | null => {
  const unfilled = fvgs.filter((fvg) => !fvg.filled && fvg.type === type);
  if (unfilled.length === 0) return null;

  const last = unfilled[unfilled.length - 1];
  if (type === DIRECTION.BULLISH && currentPrice > last.high) {
    return last;
  }
  if (type === DIRECTION.BEARISH && currentPrice < last.low) {
    return last;
  }
  return null;
};
