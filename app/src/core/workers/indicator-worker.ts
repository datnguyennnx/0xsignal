import { mean, standardDeviation } from "./math-utils";

export interface WorkerRequest {
  id: string;
  type: "MACD" | "STOCHASTIC" | "BOLLINGER" | "RSI" | "EMA" | "SMA";
  data: any;
}

export interface WorkerResponse {
  id: string;
  result: any;
  error?: string;
}

interface MACDParams {
  prices: number[];
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
}

interface StochasticParams {
  closes: number[];
  highs: number[];
  lows: number[];
  kPeriod?: number;
  dPeriod?: number;
}

interface BollingerParams {
  prices: number[];
  period?: number;
  stdDev?: number;
}

interface RSIParams {
  prices: number[];
  period?: number;
}

interface EMAParams {
  prices: number[];
  period: number;
}

interface SMAParams {
  prices: number[];
  period: number;
}

const calculateEMA = (prices: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const emaArray: number[] = [];
  let ema = prices[0];

  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      emaArray.push(prices[0]);
    } else {
      ema = prices[i] * k + ema * (1 - k);
      emaArray.push(ema);
    }
  }

  return emaArray;
};

const calculateSMA = (prices: number[], period: number): number[] => {
  const smaArray: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      smaArray.push(NaN);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      smaArray.push(mean(slice));
    }
  }

  return smaArray;
};

const calculateMACD = (params: MACDParams) => {
  const { prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = params;

  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = macdLine.map((macd, i) => macd - signalLine[i]);

  const current = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  const hist = histogram[histogram.length - 1];

  let trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  if (current > 0 && hist > 0) {
    trend = "BULLISH";
  } else if (current < 0 && hist < 0) {
    trend = "BEARISH";
  } else {
    trend = "NEUTRAL";
  }

  return {
    macd: current,
    signal,
    histogram: hist,
    trend,
    series: {
      macd: macdLine,
      signal: signalLine,
      histogram,
    },
  };
};

const calculateStochastic = (params: StochasticParams) => {
  const { closes, highs, lows, kPeriod = 14, dPeriod = 3 } = params;

  const kSeries: number[] = [];

  for (let i = kPeriod - 1; i < closes.length; i++) {
    const windowHighs = highs.slice(i - kPeriod + 1, i + 1);
    const windowLows = lows.slice(i - kPeriod + 1, i + 1);
    const windowClose = closes[i];

    const hh = Math.max(...windowHighs);
    const ll = Math.min(...windowLows);
    const range = hh - ll;
    const kVal = range === 0 ? 50 : ((windowClose - ll) / range) * 100;
    kSeries.push(kVal);
  }

  const dSeries: number[] = [];
  for (let i = dPeriod - 1; i < kSeries.length; i++) {
    const window = kSeries.slice(i - dPeriod + 1, i + 1);
    dSeries.push(mean(window));
  }

  const k = kSeries[kSeries.length - 1];
  const d = dSeries[dSeries.length - 1];

  let signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  if (k > 80) {
    signal = "OVERBOUGHT";
  } else if (k < 20) {
    signal = "OVERSOLD";
  } else {
    signal = "NEUTRAL";
  }

  let crossover: "BULLISH" | "BEARISH" | "NONE" = "NONE";
  if (kSeries.length >= 2 && dSeries.length >= 2) {
    const prevK = kSeries[kSeries.length - 2];
    const prevD = dSeries[dSeries.length - 2];

    if (prevK <= prevD && k > d) {
      crossover = "BULLISH";
    } else if (prevK >= prevD && k < d) {
      crossover = "BEARISH";
    }
  }

  return {
    k: Math.round(k * 100) / 100,
    d: Math.round(d * 100) / 100,
    signal,
    crossover,
    series: {
      k: kSeries,
      d: dSeries,
    },
  };
};

const calculateBollinger = (params: BollingerParams) => {
  const { prices, period = 20, stdDev = 2 } = params;

  const sma = calculateSMA(prices, period);
  const upperBand: number[] = [];
  const lowerBand: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upperBand.push(NaN);
      lowerBand.push(NaN);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const std = standardDeviation(slice);
      upperBand.push(sma[i] + stdDev * std);
      lowerBand.push(sma[i] - stdDev * std);
    }
  }

  const currentPrice = prices[prices.length - 1];
  const middle = sma[sma.length - 1];
  const upper = upperBand[upperBand.length - 1];
  const lower = lowerBand[lowerBand.length - 1];

  const bandwidth = (upper - lower) / middle;
  const percentB = (currentPrice - lower) / (upper - lower);

  return {
    upperBand: upper,
    middleBand: middle,
    lowerBand: lower,
    bandwidth,
    percentB,
    series: {
      upper: upperBand,
      middle: sma,
      lower: lowerBand,
    },
  };
};

const calculateRSI = (params: RSIParams) => {
  const { prices, period = 14 } = params;

  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? Math.abs(c) : 0));

  const avgGain = mean(gains.slice(0, period));
  const avgLoss = mean(losses.slice(0, period));

  let currentAvgGain = avgGain;
  let currentAvgLoss = avgLoss;

  const rsiSeries: number[] = [];

  for (let i = period; i < changes.length; i++) {
    currentAvgGain = (currentAvgGain * (period - 1) + gains[i]) / period;
    currentAvgLoss = (currentAvgLoss * (period - 1) + losses[i]) / period;

    const rs = currentAvgLoss === 0 ? 100 : currentAvgGain / currentAvgLoss;
    const rsi = 100 - 100 / (1 + rs);
    rsiSeries.push(rsi);
  }

  const currentRSI = rsiSeries[rsiSeries.length - 1];

  let signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  if (currentRSI > 70) {
    signal = "OVERBOUGHT";
  } else if (currentRSI < 30) {
    signal = "OVERSOLD";
  } else {
    signal = "NEUTRAL";
  }

  return {
    rsi: currentRSI,
    signal,
    series: rsiSeries,
  };
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, type, data } = event.data;

  try {
    let result: any;

    switch (type) {
      case "MACD":
        result = calculateMACD(data as MACDParams);
        break;
      case "STOCHASTIC":
        result = calculateStochastic(data as StochasticParams);
        break;
      case "BOLLINGER":
        result = calculateBollinger(data as BollingerParams);
        break;
      case "RSI":
        result = calculateRSI(data as RSIParams);
        break;
      case "EMA":
        result = calculateEMA((data as EMAParams).prices, (data as EMAParams).period);
        break;
      case "SMA":
        result = calculateSMA((data as SMAParams).prices, (data as SMAParams).period);
        break;
      default:
        throw new Error(`Unknown calculation type: ${type}`);
    }

    const response: WorkerResponse = { id, result };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id,
      result: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    self.postMessage(response);
  }
};
