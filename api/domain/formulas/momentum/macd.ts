import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { calculateEMA, calculateEMASeries } from "../trend/moving-averages";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// MACD (Moving Average Convergence Divergence) - Momentum Analysis
// ============================================================================
// Measures momentum by comparing two exponential moving averages
//
// Formula:
// MACD Line = EMA(12) - EMA(26)
// Signal Line = EMA(9) of MACD Line
// Histogram = MACD Line - Signal Line
//
// Interpretation:
// - MACD > 0: Bullish momentum
// - MACD < 0: Bearish momentum
// - MACD crosses above Signal: Buy signal
// - MACD crosses below Signal: Sell signal
// ============================================================================

export interface MACDResult {
  readonly macd: number;
  readonly signal: number;
  readonly histogram: number;
  readonly trend: "BULLISH" | "BEARISH" | "NEUTRAL";
}

/**
 * Pure function to calculate MACD
 * @param prices - Array of prices (minimum 26 for standard MACD)
 * @param fastPeriod - Fast EMA period (default: 12)
 * @param slowPeriod - Slow EMA period (default: 26)
 * @param signalPeriod - Signal line EMA period (default: 9)
 */
export const calculateMACD = (
  prices: ReadonlyArray<number>,
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult => {
  // Calculate fast and slow EMAs
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  // MACD line = Fast EMA - Slow EMA
  const macd = fastEMA.value - slowEMA.value;

  // For signal line, we need MACD series
  // Approximate by calculating EMA series and deriving MACD series
  const fastSeries = calculateEMASeries(prices, fastPeriod);
  const slowSeries = calculateEMASeries(prices, slowPeriod);

  // Calculate MACD series (only where both EMAs exist)
  const macdSeries = fastSeries.map((fast, i) => fast - slowSeries[i]);

  // Signal line = EMA of MACD line
  const signalEMA = calculateEMA(macdSeries, signalPeriod);
  const signal = signalEMA.value;

  // Histogram = MACD - Signal
  const histogram = macd - signal;

  // Determine trend
  let trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  if (macd > 0 && histogram > 0) {
    trend = "BULLISH";
  } else if (macd < 0 && histogram < 0) {
    trend = "BEARISH";
  } else {
    trend = "NEUTRAL";
  }

  return {
    macd,
    signal,
    histogram,
    trend,
  };
};

/**
 * Pure function to calculate MACD series for all points
 * Returns arrays of MACD, Signal, and Histogram values
 */
export const calculateMACDSeries = (
  prices: ReadonlyArray<number>,
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  readonly macd: ReadonlyArray<number>;
  readonly signal: ReadonlyArray<number>;
  readonly histogram: ReadonlyArray<number>;
} => {
  // Calculate EMA series
  const fastSeries = calculateEMASeries(prices, fastPeriod);
  const slowSeries = calculateEMASeries(prices, slowPeriod);

  // MACD series
  const macdSeries = fastSeries.map((fast, i) => fast - slowSeries[i]);

  // Signal series (EMA of MACD)
  const signalSeries = calculateEMASeries(macdSeries, signalPeriod);

  // Histogram series
  const histogramSeries = macdSeries
    .slice(signalPeriod - 1)
    .map((macd, i) => macd - signalSeries[i]);

  return {
    macd: macdSeries,
    signal: signalSeries,
    histogram: histogramSeries,
  };
};

/**
 * Effect-based wrapper for MACD calculation
 */
export const computeMACD = (
  prices: ReadonlyArray<number>,
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): Effect.Effect<MACDResult> =>
  Effect.sync(() => calculateMACD(prices, fastPeriod, slowPeriod, signalPeriod));

/**
 * Effect-based wrapper for MACD from CryptoPrice
 * Approximates using 24h data
 */
export const computeMACDFromPrice = (
  price: CryptoPrice,
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): Effect.Effect<MACDResult> => {
  // For single price point, approximate using 24h data
  const prices =
    price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];

  return computeMACD(
    prices,
    Math.min(fastPeriod, prices.length),
    Math.min(slowPeriod, prices.length),
    Math.min(signalPeriod, prices.length)
  );
};

// ============================================================================
// MACD CROSSOVER DETECTION
// ============================================================================

export interface MACDCrossover {
  readonly symbol: string;
  readonly hasCrossover: boolean;
  readonly crossoverType: "BULLISH" | "BEARISH" | "NONE";
  readonly strength: number; // 0-100
  readonly macd: number;
  readonly signal: number;
  readonly histogram: number;
}

/**
 * Pure function to detect MACD crossovers
 * Bullish: MACD crosses above Signal
 * Bearish: MACD crosses below Signal
 */
export const detectMACDCrossover = (price: CryptoPrice, macd: MACDResult): MACDCrossover => {
  const hasCrossover = Math.abs(macd.histogram) < Math.abs(macd.macd) * 0.1;

  let crossoverType: "BULLISH" | "BEARISH" | "NONE" = "NONE";
  let strength = 0;

  if (hasCrossover) {
    if (macd.histogram > 0) {
      crossoverType = "BULLISH";
      strength = Math.min(Math.abs(macd.histogram) * 10, 100);
    } else {
      crossoverType = "BEARISH";
      strength = Math.min(Math.abs(macd.histogram) * 10, 100);
    }
  }

  return {
    symbol: price.symbol,
    hasCrossover,
    crossoverType,
    strength: Math.round(strength),
    macd: macd.macd,
    signal: macd.signal,
    histogram: macd.histogram,
  };
};

/**
 * Effect-based crossover detection
 */
export const detectCrossover = (price: CryptoPrice): Effect.Effect<MACDCrossover> =>
  Effect.gen(function* () {
    const macd = yield* computeMACDFromPrice(price);
    return yield* Effect.sync(() => detectMACDCrossover(price, macd));
  });

// ============================================================================
// FORMULA METADATA
// ============================================================================

export const MACDMetadata: FormulaMetadata = {
  name: "MACD",
  category: "momentum",
  difficulty: "beginner",
  description: "Moving Average Convergence Divergence - momentum indicator using two EMAs",
  requiredInputs: ["prices"],
  optionalInputs: ["fastPeriod", "slowPeriod", "signalPeriod"],
  minimumDataPoints: 26,
  outputType: "MACDResult",
  useCases: [
    "trend identification",
    "momentum analysis",
    "crossover signals",
    "divergence detection",
  ],
  timeComplexity: "O(n)",
  dependencies: ["EMA"],
};
