/** MACD (Moving Average Convergence Divergence) - Momentum analysis */
// MACD = EMA(12) - EMA(26), Signal = EMA(9) of MACD, Histogram = MACD - Signal

import { Effect, Match } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { calculateEMA, calculateEMASeries } from "../trend/moving-averages";
import type { FormulaMetadata } from "../core/types";

export interface MACDResult {
  readonly macd: number;
  readonly signal: number;
  readonly histogram: number;
  readonly trend: "BULLISH" | "BEARISH" | "NEUTRAL";
}

export interface MACDCrossover {
  readonly symbol: string;
  readonly hasCrossover: boolean;
  readonly crossoverType: "BULLISH" | "BEARISH" | "NONE";
  readonly strength: number;
  readonly macd: number;
  readonly signal: number;
  readonly histogram: number;
}

// Trend classification
const classifyTrend = Match.type<{ macd: number; histogram: number }>().pipe(
  Match.when(
    ({ macd, histogram }) => macd > 0 && histogram > 0,
    () => "BULLISH" as const
  ),
  Match.when(
    ({ macd, histogram }) => macd < 0 && histogram < 0,
    () => "BEARISH" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Crossover type classification
const classifyCrossoverType = Match.type<{ hasCrossover: boolean; histogram: number }>().pipe(
  Match.when(
    ({ hasCrossover, histogram }) => hasCrossover && histogram > 0,
    () => "BULLISH" as const
  ),
  Match.when(
    ({ hasCrossover, histogram }) => hasCrossover && histogram < 0,
    () => "BEARISH" as const
  ),
  Match.orElse(() => "NONE" as const)
);

// Calculate MACD
export const calculateMACD = (
  prices: ReadonlyArray<number>,
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult => {
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  const macd = fastEMA.value - slowEMA.value;

  const fastSeries = calculateEMASeries(prices, fastPeriod);
  const slowSeries = calculateEMASeries(prices, slowPeriod);
  const macdSeries = fastSeries.map((fast, i) => fast - slowSeries[i]);
  const signalEMA = calculateEMA(macdSeries, signalPeriod);
  const signal = signalEMA.value;
  const histogram = macd - signal;

  return { macd, signal, histogram, trend: classifyTrend({ macd, histogram }) };
};

// Calculate MACD series
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
  const fastSeries = calculateEMASeries(prices, fastPeriod);
  const slowSeries = calculateEMASeries(prices, slowPeriod);
  const macdSeries = fastSeries.map((fast, i) => fast - slowSeries[i]);
  const signalSeries = calculateEMASeries(macdSeries, signalPeriod);
  const histogramSeries = macdSeries
    .slice(signalPeriod - 1)
    .map((macd, i) => macd - signalSeries[i]);

  return { macd: macdSeries, signal: signalSeries, histogram: histogramSeries };
};

// Effect-based wrapper
export const computeMACD = (
  prices: ReadonlyArray<number>,
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): Effect.Effect<MACDResult> =>
  Effect.sync(() => calculateMACD(prices, fastPeriod, slowPeriod, signalPeriod));

// Effect-based MACD from CryptoPrice
export const computeMACDFromPrice = (
  price: CryptoPrice,
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): Effect.Effect<MACDResult> => {
  const prices =
    price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
  return computeMACD(
    prices,
    Math.min(fastPeriod, prices.length),
    Math.min(slowPeriod, prices.length),
    Math.min(signalPeriod, prices.length)
  );
};

// Detect MACD crossover
export const detectMACDCrossover = (price: CryptoPrice, macd: MACDResult): MACDCrossover => {
  const hasCrossover = Math.abs(macd.histogram) < Math.abs(macd.macd) * 0.1;
  const crossoverType = classifyCrossoverType({ hasCrossover, histogram: macd.histogram });
  const strength = hasCrossover ? Math.min(Math.abs(macd.histogram) * 10, 100) : 0;

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

// Effect-based crossover detection
export const detectCrossover = (price: CryptoPrice): Effect.Effect<MACDCrossover> =>
  Effect.gen(function* () {
    const macd = yield* computeMACDFromPrice(price);
    return yield* Effect.sync(() => detectMACDCrossover(price, macd));
  });

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
