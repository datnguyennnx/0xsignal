import type { ChartDataPoint } from "../../types/chart";
import type { LiquidityZone, LiquidityType } from "./types";
import { ICT_TYPES } from "../constants";

export const detectLiquidityZones = (
  data: ChartDataPoint[],
  tolerance: number
): LiquidityZone[] => {
  const zones: LiquidityZone[] = [];
  if (data.length < 10) return zones;

  const avgPrice = data.reduce((sum, d) => sum + d.close, 0) / data.length;
  const toleranceAbs = avgPrice * (tolerance / 100);

  const highClusters = new Map<number, { indices: number[]; price: number }>();
  for (let i = 0; i < data.length; i++) {
    const high = data[i].high;
    let found = false;
    for (const cluster of highClusters.values()) {
      if (Math.abs(high - cluster.price) <= toleranceAbs) {
        cluster.indices.push(i);
        cluster.price =
          (cluster.price * (cluster.indices.length - 1) + high) / cluster.indices.length;
        found = true;
        break;
      }
    }
    if (!found) highClusters.set(i, { indices: [i], price: high });
  }

  const lowClusters = new Map<number, { indices: number[]; price: number }>();
  for (let i = 0; i < data.length; i++) {
    const low = data[i].low;
    let found = false;
    for (const cluster of lowClusters.values()) {
      if (Math.abs(low - cluster.price) <= toleranceAbs) {
        cluster.indices.push(i);
        cluster.price =
          (cluster.price * (cluster.indices.length - 1) + low) / cluster.indices.length;
        found = true;
        break;
      }
    }
    if (!found) lowClusters.set(i, { indices: [i], price: low });
  }

  for (const cluster of highClusters.values()) {
    if (cluster.indices.length >= 2) {
      const startIdx = Math.min(...cluster.indices);
      const endIdx = Math.max(...cluster.indices);
      let swept = false;
      let sweepTime: number | undefined;
      for (let i = endIdx + 1; i < data.length; i++) {
        if (data[i].high > cluster.price + toleranceAbs) {
          swept = true;
          sweepTime = data[i].time;
          break;
        }
      }
      zones.push({
        type: ICT_TYPES.LIQUIDITY.BSL,
        price: cluster.price,
        startTime: data[startIdx].time,
        endTime: data[endIdx].time,
        swept,
        sweepTime,
        touchCount: cluster.indices.length,
      });
    }
  }

  for (const cluster of lowClusters.values()) {
    if (cluster.indices.length >= 2) {
      const startIdx = Math.min(...cluster.indices);
      const endIdx = Math.max(...cluster.indices);
      let swept = false;
      let sweepTime: number | undefined;
      for (let i = endIdx + 1; i < data.length; i++) {
        if (data[i].low < cluster.price - toleranceAbs) {
          swept = true;
          sweepTime = data[i].time;
          break;
        }
      }
      zones.push({
        type: ICT_TYPES.LIQUIDITY.SSL,
        price: cluster.price,
        startTime: data[startIdx].time,
        endTime: data[endIdx].time,
        swept,
        sweepTime,
        touchCount: cluster.indices.length,
      });
    }
  }

  return zones;
};

export const getUnsweptLiquidity = (zones: LiquidityZone[]): LiquidityZone[] => {
  return zones.filter((zone) => !zone.swept);
};

export const getRecentLiquidity = (
  zones: LiquidityZone[],
  count: number,
  type?: LiquidityType
): LiquidityZone[] => {
  let filtered = zones;
  if (type) {
    filtered = zones.filter((zone) => zone.type === type);
  }
  return filtered.slice(-count);
};

export const getActiveLiquidity = (
  zones: LiquidityZone[],
  currentPrice: number,
  type: LiquidityType
): LiquidityZone | null => {
  const unswept = zones.filter((zone) => !zone.swept && zone.type === type);
  if (unswept.length === 0) return null;

  const last = unswept[unswept.length - 1];
  if (type === ICT_TYPES.LIQUIDITY.BSL && currentPrice < last.price) {
    return last;
  }
  if (type === ICT_TYPES.LIQUIDITY.SSL && currentPrice > last.price) {
    return last;
  }
  return null;
};
