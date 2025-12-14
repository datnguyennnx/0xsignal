import type { ChartDataPoint } from "@0xsignal/shared";

export type WyckoffPhase = "A" | "B" | "C" | "D" | "E";
export type WyckoffCycle = "accumulation" | "distribution" | "markup" | "markdown" | "unknown";
export type ClimaxType = "SC" | "BC";
export type TestType = "ST" | "spring" | "upthrust" | "LPS" | "LPSY" | "SOS" | "SOW";

export interface TradingRange {
  readonly startTime: number;
  readonly endTime: number;
  readonly high: number;
  readonly low: number;
  readonly midpoint: number;
}

export interface Climax {
  readonly type: ClimaxType;
  readonly time: number;
  readonly price: number;
  readonly volume: number;
  readonly index: number;
}

export interface WyckoffEvent {
  readonly type: TestType;
  readonly time: number;
  readonly price: number;
  readonly index: number;
  readonly significance: "high" | "medium" | "low";
}

export interface PhaseMarker {
  readonly phase: WyckoffPhase;
  readonly cycle: WyckoffCycle;
  readonly startTime: number;
  readonly endTime: number;
  readonly startIndex: number;
  readonly endIndex: number;
}

export interface EffortResult {
  readonly time: number;
  readonly effort: number;
  readonly result: number;
  readonly divergence: "bullish" | "bearish" | "neutral";
  readonly index: number;
}

export interface WyckoffAnalysisResult {
  readonly cycle: WyckoffCycle;
  readonly currentPhase: WyckoffPhase | null;
  readonly tradingRange: TradingRange | null;
  readonly climaxes: Climax[];
  readonly events: WyckoffEvent[];
  readonly phases: PhaseMarker[];
  readonly effortResults: EffortResult[];
}

export interface WyckoffConfig {
  volumeLookback: number;
  volumeClimaxMultiplier: number;
  spreadClimaxMultiplier: number;
  springVolThreshold: number;
  minRangeLength: number;
  atrPeriod: number;
}

const DEFAULT_CONFIG: WyckoffConfig = {
  volumeLookback: 20,
  volumeClimaxMultiplier: 2.0,
  spreadClimaxMultiplier: 1.5,
  springVolThreshold: 0.6,
  minRangeLength: 10,
  atrPeriod: 14,
};

const average = (arr: number[]): number =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

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

const getSpread = (bar: ChartDataPoint): number => bar.high - bar.low;

const isDownBar = (bar: ChartDataPoint): boolean => bar.close < bar.open;

const isUpBar = (bar: ChartDataPoint): boolean => bar.close > bar.open;

const detectSellingClimax = (
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

const detectBuyingClimax = (
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

const detectSpring = (
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

const detectUpthrust = (
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

const detectSecondaryTest = (
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

const detectLPS = (
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

const detectLPSY = (
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

const detectSOS = (
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

const detectSOW = (
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

const calculateEffortResult = (
  data: ChartDataPoint[],
  index: number,
  lookback: number = 5
): EffortResult | null => {
  if (index < lookback) return null;

  const bar = data[index];
  const prevBars = data.slice(index - lookback, index);
  const avgVolume = average(prevBars.map((b) => b.volume));
  const avgSpread = average(prevBars.map(getSpread));

  const effort = bar.volume / avgVolume;
  const result = getSpread(bar) / avgSpread;

  let divergence: "bullish" | "bearish" | "neutral" = "neutral";

  if (effort > 1.5 && result < 0.5) {
    divergence = isDownBar(bar) ? "bullish" : "bearish";
  } else if (effort < 0.5 && result > 1.5) {
    divergence = isUpBar(bar) ? "bullish" : "bearish";
  }

  return {
    time: bar.time,
    effort,
    result,
    divergence,
    index,
  };
};

const detectTradingRange = (
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

const determineCycle = (climaxes: Climax[], data: ChartDataPoint[]): WyckoffCycle => {
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

const analyzeWyckoff = (data: ChartDataPoint[], config: WyckoffConfig): WyckoffAnalysisResult => {
  if (data.length < config.volumeLookback + 10) {
    return {
      cycle: "unknown",
      currentPhase: null,
      tradingRange: null,
      climaxes: [],
      events: [],
      phases: [],
      effortResults: [],
    };
  }

  const climaxes: Climax[] = [];
  const events: WyckoffEvent[] = [];
  const effortResults: EffortResult[] = [];

  for (let i = config.volumeLookback; i < data.length; i++) {
    const sc = detectSellingClimax(data, i, config);
    if (sc) climaxes.push(sc);

    const bc = detectBuyingClimax(data, i, config);
    if (bc) climaxes.push(bc);

    const er = calculateEffortResult(data, i, 5);
    if (er && er.divergence !== "neutral") {
      effortResults.push(er);
    }
  }

  if (climaxes.length === 0) {
    return {
      cycle: "unknown",
      currentPhase: null,
      tradingRange: null,
      climaxes: [],
      events: [],
      phases: [],
      effortResults: effortResults.slice(-10),
    };
  }

  const lastClimax = climaxes[climaxes.length - 1];
  const isAccumulation = lastClimax.type === "SC";

  const rangeStart = lastClimax.index;
  const rangeEnd = data.length - 1;
  const tradingRange = detectTradingRange(data, rangeStart, rangeEnd);

  if (tradingRange) {
    for (let i = rangeStart + 1; i < data.length; i++) {
      const st = detectSecondaryTest(
        data,
        i,
        lastClimax.price,
        lastClimax.index,
        isAccumulation,
        config
      );
      if (st) events.push(st);

      if (isAccumulation) {
        const spring = detectSpring(data, i, tradingRange.low, config);
        if (spring) events.push(spring);

        const lps = detectLPS(data, i, tradingRange.low, config);
        if (lps) events.push(lps);

        const sos = detectSOS(data, i, tradingRange.high, config);
        if (sos) events.push(sos);
      } else {
        const upthrust = detectUpthrust(data, i, tradingRange.high, config);
        if (upthrust) events.push(upthrust);

        const lpsy = detectLPSY(data, i, tradingRange.high, config);
        if (lpsy) events.push(lpsy);

        const sow = detectSOW(data, i, tradingRange.low, config);
        if (sow) events.push(sow);
      }
    }
  }

  const cycle = determineCycle(climaxes, data);

  let currentPhase: WyckoffPhase | null = null;
  if (events.length > 0) {
    const lastEvent = events[events.length - 1];
    if (lastEvent.type === "ST") currentPhase = "A";
    else if (lastEvent.type === "spring" || lastEvent.type === "upthrust") currentPhase = "C";
    else if (lastEvent.type === "LPS" || lastEvent.type === "LPSY") currentPhase = "D";
    else if (lastEvent.type === "SOS" || lastEvent.type === "SOW") currentPhase = "D";
  } else if (climaxes.length > 0) {
    currentPhase = "A";
  }

  return {
    cycle,
    currentPhase,
    tradingRange,
    climaxes: climaxes.slice(-5),
    events: events.slice(-10),
    phases: [],
    effortResults: effortResults.slice(-10),
  };
};

export interface WyckoffWorkerRequest {
  id: string;
  type: "ANALYZE_WYCKOFF";
  data: {
    candles: ChartDataPoint[];
    config?: Partial<WyckoffConfig>;
  };
}

export interface WyckoffWorkerResponse {
  id: string;
  result: WyckoffAnalysisResult | null;
  error?: string;
}

self.onmessage = (event: MessageEvent<WyckoffWorkerRequest>) => {
  const { id, type, data } = event.data;

  try {
    if (type !== "ANALYZE_WYCKOFF") {
      throw new Error(`Unknown type: ${type}`);
    }

    const config = { ...DEFAULT_CONFIG, ...data.config };
    const result = analyzeWyckoff(data.candles, config);

    self.postMessage({ id, result } as WyckoffWorkerResponse);
  } catch (error) {
    self.postMessage({
      id,
      result: null,
      error: error instanceof Error ? error.message : "Unknown error",
    } as WyckoffWorkerResponse);
  }
};
