/**
 * Web Worker for ICT (Inner Circle Trader) calculations
 * Offloads heavy pattern detection from main thread
 */

import type { ChartDataPoint } from "@0xsignal/shared";

// ===== TYPES =====

export type SwingType = "HH" | "HL" | "LH" | "LL";
export type TrendDirection = "bullish" | "bearish" | "neutral";
export type StructureBreak = "BOS" | "ChoCH";
export type FVGType = "bullish" | "bearish";
export type OrderBlockType = "bullish" | "bearish";
export type LiquidityType = "BSL" | "SSL";

export interface SwingPoint {
  readonly time: number;
  readonly price: number;
  readonly type: SwingType;
  readonly index: number;
}

export interface StructureEvent {
  readonly time: number;
  readonly price: number;
  readonly type: StructureBreak;
  readonly direction: TrendDirection;
  readonly index: number;
}

export interface MarketStructure {
  readonly swings: SwingPoint[];
  readonly events: StructureEvent[];
  readonly currentTrend: TrendDirection;
}

export interface FairValueGap {
  readonly startTime: number;
  readonly endTime: number;
  readonly type: FVGType;
  readonly high: number;
  readonly low: number;
  readonly midpoint: number;
  readonly filled: boolean;
  readonly index: number;
}

export interface OrderBlock {
  readonly time: number;
  readonly type: OrderBlockType;
  readonly high: number;
  readonly low: number;
  readonly mitigated: boolean;
  readonly index: number;
}

export interface LiquidityZone {
  readonly type: LiquidityType;
  readonly price: number;
  readonly startTime: number;
  readonly endTime: number;
  readonly swept: boolean;
  readonly sweepTime?: number;
  readonly touchCount: number;
}

export interface OTEZone {
  readonly startTime: number;
  readonly endTime: number;
  readonly direction: TrendDirection;
  readonly fibLevels: Record<string, number>;
  readonly goldenPocketHigh: number;
  readonly goldenPocketLow: number;
}

export interface ICTAnalysisResult {
  readonly marketStructure: MarketStructure;
  readonly fvgs: FairValueGap[];
  readonly orderBlocks: OrderBlock[];
  readonly liquidityZones: LiquidityZone[];
  readonly oteZones: OTEZone[];
}

export interface ICTWorkerRequest {
  id: string;
  type: "ANALYZE_ICT";
  data: {
    candles: ChartDataPoint[];
    config?: Partial<ICTConfig>;
  };
}

export interface ICTWorkerResponse {
  id: string;
  result: ICTAnalysisResult | null;
  error?: string;
}

export interface ICTConfig {
  swingLookback: number;
  fvgMinSize: number;
  obLookback: number;
  liquidityTolerance: number;
  atrPeriod: number;
}

const DEFAULT_CONFIG: ICTConfig = {
  swingLookback: 3,
  fvgMinSize: 0.05,
  obLookback: 10,
  liquidityTolerance: 0.15,
  atrPeriod: 14,
};

// ===== UTILITY FUNCTIONS =====

const calculateATR = (data: ChartDataPoint[], period: number): number => {
  if (data.length < period + 1) return 0;
  let atrSum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1]?.close ?? data[i].open;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    atrSum += tr;
  }
  return atrSum / period;
};

const isSwingHigh = (data: ChartDataPoint[], index: number, lookback: number): boolean => {
  if (index < lookback || index >= data.length - lookback) return false;
  const high = data[index].high;
  for (let i = index - lookback; i <= index + lookback; i++) {
    if (i !== index && data[i].high >= high) return false;
  }
  return true;
};

const isSwingLow = (data: ChartDataPoint[], index: number, lookback: number): boolean => {
  if (index < lookback || index >= data.length - lookback) return false;
  const low = data[index].low;
  for (let i = index - lookback; i <= index + lookback; i++) {
    if (i !== index && data[i].low <= low) return false;
  }
  return true;
};

// ===== DETECTION ALGORITHMS =====

interface RawSwing {
  index: number;
  price: number;
  isHigh: boolean;
  time: number;
}

const detectRawSwings = (data: ChartDataPoint[], lookback: number): RawSwing[] => {
  const swings: RawSwing[] = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    if (isSwingHigh(data, i, lookback)) {
      swings.push({ index: i, price: data[i].high, isHigh: true, time: data[i].time });
    }
    if (isSwingLow(data, i, lookback)) {
      swings.push({ index: i, price: data[i].low, isHigh: false, time: data[i].time });
    }
  }

  // Sort by index and filter consecutive same-type swings
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

const detectMarketStructure = (data: ChartDataPoint[], lookback: number): MarketStructure => {
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

    // Detect structure breaks
    if (swings.length >= 3) {
      const curr = swings[swings.length - 1];

      // BOS: Continuation
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

      // ChoCH: Reversal
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

      // Initial trend
      if (trend === "neutral") {
        const prev = swings[swings.length - 2];
        if (curr.type === "HH" && prev.type === "HL") trend = "bullish";
        else if (curr.type === "LL" && prev.type === "LH") trend = "bearish";
      }
    }
  }

  return { swings, events, currentTrend: trend };
};

const detectFVGs = (data: ChartDataPoint[], minSizePercent: number): FairValueGap[] => {
  const fvgs: FairValueGap[] = [];
  if (data.length < 3) return fvgs;

  for (let i = 2; i < data.length; i++) {
    const c1 = data[i - 2];
    const c3 = data[i];
    const avgPrice = (c1.close + c3.close) / 2;
    const minSize = avgPrice * (minSizePercent / 100);

    // Bullish FVG
    if (c1.high < c3.low && c3.low - c1.high >= minSize) {
      let filled = false;
      for (let j = i + 1; j < data.length; j++) {
        if (data[j].low <= c1.high) {
          filled = true;
          break;
        }
      }
      fvgs.push({
        startTime: c1.time,
        endTime: c3.time,
        type: "bullish",
        high: c3.low,
        low: c1.high,
        midpoint: (c3.low + c1.high) / 2,
        filled,
        index: i,
      });
    }

    // Bearish FVG
    if (c1.low > c3.high && c1.low - c3.high >= minSize) {
      let filled = false;
      for (let j = i + 1; j < data.length; j++) {
        if (data[j].high >= c1.low) {
          filled = true;
          break;
        }
      }
      fvgs.push({
        startTime: c1.time,
        endTime: c3.time,
        type: "bearish",
        high: c1.low,
        low: c3.high,
        midpoint: (c1.low + c3.high) / 2,
        filled,
        index: i,
      });
    }
  }

  return fvgs;
};

const detectOrderBlocks = (data: ChartDataPoint[], atr: number): OrderBlock[] => {
  const orderBlocks: OrderBlock[] = [];
  if (data.length < 3 || atr === 0) return orderBlocks;

  for (let i = 1; i < data.length - 1; i++) {
    const candle = data[i];
    const nextCandle = data[i + 1];
    const nextBodySize = Math.abs(nextCandle.close - nextCandle.open);

    // Bullish OB: Bearish candle + strong bullish move
    if (
      candle.close < candle.open &&
      nextCandle.close > nextCandle.open &&
      nextBodySize > atr * 1.5
    ) {
      let mitigated = false;
      for (let j = i + 2; j < data.length; j++) {
        if (data[j].low <= candle.low) {
          mitigated = true;
          break;
        }
      }
      orderBlocks.push({
        time: candle.time,
        type: "bullish",
        high: candle.high,
        low: candle.low,
        mitigated,
        index: i,
      });
    }

    // Bearish OB: Bullish candle + strong bearish move
    if (
      candle.close > candle.open &&
      nextCandle.close < nextCandle.open &&
      nextBodySize > atr * 1.5
    ) {
      let mitigated = false;
      for (let j = i + 2; j < data.length; j++) {
        if (data[j].high >= candle.high) {
          mitigated = true;
          break;
        }
      }
      orderBlocks.push({
        time: candle.time,
        type: "bearish",
        high: candle.high,
        low: candle.low,
        mitigated,
        index: i,
      });
    }
  }

  return orderBlocks;
};

const detectLiquidityZones = (data: ChartDataPoint[], tolerance: number): LiquidityZone[] => {
  const zones: LiquidityZone[] = [];
  if (data.length < 10) return zones;

  const avgPrice = data.reduce((sum, d) => sum + d.close, 0) / data.length;
  const toleranceAbs = avgPrice * (tolerance / 100);

  // Find equal highs (BSL)
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

  // Find equal lows (SSL)
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

  // Convert to zones (min 2 touches)
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
        type: "BSL",
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
        type: "SSL",
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

const calculateOTEZones = (swings: SwingPoint[], events: StructureEvent[]): OTEZone[] => {
  const oteZones: OTEZone[] = [];
  const recentEvents = events.slice(-3);

  for (const event of recentEvents) {
    const relevantSwings = swings.filter((s) => s.index <= event.index);
    if (relevantSwings.length < 2) continue;

    const lastTwo = relevantSwings.slice(-2);
    const swingLow = Math.min(lastTwo[0].price, lastTwo[1].price);
    const swingHigh = Math.max(lastTwo[0].price, lastTwo[1].price);
    const range = swingHigh - swingLow;
    const dir = event.direction;

    const fibLevels: Record<string, number> = {
      "0": dir === "bullish" ? swingLow : swingHigh,
      "0.236": dir === "bullish" ? swingLow + range * 0.236 : swingHigh - range * 0.236,
      "0.382": dir === "bullish" ? swingLow + range * 0.382 : swingHigh - range * 0.382,
      "0.5": dir === "bullish" ? swingLow + range * 0.5 : swingHigh - range * 0.5,
      "0.618": dir === "bullish" ? swingLow + range * 0.618 : swingHigh - range * 0.618,
      "0.786": dir === "bullish" ? swingLow + range * 0.786 : swingHigh - range * 0.786,
      "1": dir === "bullish" ? swingHigh : swingLow,
    };

    oteZones.push({
      startTime: lastTwo[0].time,
      endTime: lastTwo[1].time,
      direction: dir,
      fibLevels,
      goldenPocketHigh: fibLevels["0.618"],
      goldenPocketLow: fibLevels["0.786"],
    });
  }

  return oteZones;
};

// ===== MAIN ANALYSIS =====

const analyzeICT = (candles: ChartDataPoint[], config: ICTConfig): ICTAnalysisResult => {
  const atr = calculateATR(candles, config.atrPeriod);
  const marketStructure = detectMarketStructure(candles, config.swingLookback);
  const fvgs = detectFVGs(candles, config.fvgMinSize);
  const orderBlocks = detectOrderBlocks(candles, atr);
  const liquidityZones = detectLiquidityZones(candles, config.liquidityTolerance);
  const oteZones = calculateOTEZones(marketStructure.swings, marketStructure.events);

  return {
    marketStructure,
    fvgs,
    orderBlocks,
    liquidityZones,
    oteZones,
  };
};

// ===== WORKER MESSAGE HANDLER =====

self.onmessage = (event: MessageEvent<ICTWorkerRequest>) => {
  const { id, type, data } = event.data;

  try {
    if (type !== "ANALYZE_ICT") {
      throw new Error(`Unknown type: ${type}`);
    }

    const config = { ...DEFAULT_CONFIG, ...data.config };
    const result = analyzeICT(data.candles, config);

    self.postMessage({ id, result } as ICTWorkerResponse);
  } catch (error) {
    self.postMessage({
      id,
      result: null,
      error: error instanceof Error ? error.message : "Unknown error",
    } as ICTWorkerResponse);
  }
};
