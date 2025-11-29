/**
 * Web Worker for indicator calculations
 * Offloads heavy computations from main thread for 60fps UI
 */
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  calculateBollingerBands,
} from "@0xsignal/shared";
// Convert price array to ChartDataPoint format for shared calculations
const toChartData = (prices, highs, lows) =>
  prices.map((close, i) => ({
    time: i,
    open: close,
    high: highs?.[i] ?? close,
    low: lows?.[i] ?? close,
    close,
    volume: 0,
  }));
// Worker-specific MACD with trend analysis
const workerCalculateMACD = (params) => {
  const { prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = params;
  const data = toChartData(prices);
  const result = calculateMACD(data, fastPeriod, slowPeriod, signalPeriod);
  const macdLine = result.macd.map((d) => d.value);
  const signalLine = result.signal.map((d) => d.value);
  const histogram = result.histogram.map((d) => d.value);
  const current = macdLine[macdLine.length - 1] ?? 0;
  const signal = signalLine[signalLine.length - 1] ?? 0;
  const hist = histogram[histogram.length - 1] ?? 0;
  const trend =
    current > 0 && hist > 0 ? "BULLISH" : current < 0 && hist < 0 ? "BEARISH" : "NEUTRAL";
  return {
    macd: current,
    signal,
    histogram: hist,
    trend,
    series: { macd: macdLine, signal: signalLine, histogram },
  };
};
// Worker-specific Stochastic with signals
const workerCalculateStochastic = (params) => {
  const { closes, highs, lows, kPeriod = 14, dPeriod = 3 } = params;
  const data = toChartData(closes, highs, lows);
  const result = calculateStochastic(data, kPeriod, dPeriod);
  const kSeries = result.k.map((d) => d.value);
  const dSeries = result.d.map((d) => d.value);
  const k = kSeries[kSeries.length - 1] ?? 50;
  const d = dSeries[dSeries.length - 1] ?? 50;
  const signal = k > 80 ? "OVERBOUGHT" : k < 20 ? "OVERSOLD" : "NEUTRAL";
  let crossover = "NONE";
  if (kSeries.length >= 2 && dSeries.length >= 2) {
    const prevK = kSeries[kSeries.length - 2];
    const prevD = dSeries[dSeries.length - 2];
    if (prevK <= prevD && k > d) crossover = "BULLISH";
    else if (prevK >= prevD && k < d) crossover = "BEARISH";
  }
  return {
    k: Math.round(k * 100) / 100,
    d: Math.round(d * 100) / 100,
    signal,
    crossover,
    series: { k: kSeries, d: dSeries },
  };
};
// Worker-specific Bollinger with bandwidth/percentB
const workerCalculateBollinger = (params) => {
  const { prices, period = 20, stdDev = 2 } = params;
  const data = toChartData(prices);
  const result = calculateBollingerBands(data, period, stdDev);
  const upperBand = result.map((d) => d.upper);
  const middleBand = result.map((d) => d.middle);
  const lowerBand = result.map((d) => d.lower);
  const currentPrice = prices[prices.length - 1];
  const upper = upperBand[upperBand.length - 1] ?? currentPrice;
  const middle = middleBand[middleBand.length - 1] ?? currentPrice;
  const lower = lowerBand[lowerBand.length - 1] ?? currentPrice;
  const bandwidth = middle !== 0 ? (upper - lower) / middle : 0;
  const percentB = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;
  return {
    upperBand: upper,
    middleBand: middle,
    lowerBand: lower,
    bandwidth,
    percentB,
    series: { upper: upperBand, middle: middleBand, lower: lowerBand },
  };
};
// Worker-specific RSI with signals
const workerCalculateRSI = (params) => {
  const { prices, period = 14 } = params;
  const data = toChartData(prices);
  const result = calculateRSI(data, period);
  const rsiSeries = result.map((d) => d.value);
  const currentRSI = rsiSeries[rsiSeries.length - 1] ?? 50;
  const signal = currentRSI > 70 ? "OVERBOUGHT" : currentRSI < 30 ? "OVERSOLD" : "NEUTRAL";
  return { rsi: currentRSI, signal, series: rsiSeries };
};
// Worker-specific EMA (returns array)
const workerCalculateEMA = (params) => {
  const { prices, period } = params;
  const data = toChartData(prices);
  return calculateEMA(data, period).map((d) => d.value);
};
// Worker-specific SMA (returns array)
const workerCalculateSMA = (params) => {
  const { prices, period } = params;
  const data = toChartData(prices);
  return calculateSMA(data, period).map((d) => d.value);
};
self.onmessage = (event) => {
  const { id, type, data } = event.data;
  try {
    let result;
    switch (type) {
      case "MACD":
        result = workerCalculateMACD(data);
        break;
      case "STOCHASTIC":
        result = workerCalculateStochastic(data);
        break;
      case "BOLLINGER":
        result = workerCalculateBollinger(data);
        break;
      case "RSI":
        result = workerCalculateRSI(data);
        break;
      case "EMA":
        result = workerCalculateEMA(data);
        break;
      case "SMA":
        result = workerCalculateSMA(data);
        break;
      default:
        throw new Error(`Unknown calculation type: ${type}`);
    }
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      result: null,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
//# sourceMappingURL=indicator-worker.js.map
