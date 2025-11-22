import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { sum, mean, emaAlpha } from "../core/math";
import type { FormulaMetadata } from "../core/types";

// ============================================================================
// MOVING AVERAGES - Trend Analysis Foundation
// ============================================================================
// Simple Moving Average (SMA) and Exponential Moving Average (EMA)
// These are foundational indicators used by many other formulas
//
// SMA Formula: Average of last N prices
// EMA Formula: EMA_t = Price_t * α + EMA_t-1 * (1 - α)
//              where α = 2 / (period + 1)
// ============================================================================

export interface SMAResult {
  readonly value: number;
  readonly period: number;
}

export interface EMAResult {
  readonly value: number;
  readonly period: number;
  readonly alpha: number;
}

/**
 * Pure function to calculate Simple Moving Average
 * @param prices - Array of prices (must have at least 'period' elements)
 * @param period - Number of periods for the average
 */
export const calculateSMA = (
  prices: ReadonlyArray<number>,
  period: number = 20
): SMAResult => {
  // Take the last 'period' prices
  const relevantPrices = prices.slice(-period);
  const value = mean([...relevantPrices]);

  return {
    value,
    period,
  };
};

/**
 * Pure function to calculate SMA for each point in a series
 * Returns an array of SMA values
 */
export const calculateSMASeries = (
  prices: ReadonlyArray<number>,
  period: number = 20
): ReadonlyArray<number> => {
  const result: number[] = [];

  for (let i = period - 1; i < prices.length; i++) {
    const window = prices.slice(i - period + 1, i + 1);
    result.push(mean([...window]));
  }

  return result;
};

/**
 * Effect-based wrapper for SMA calculation
 */
export const computeSMA = (
  prices: ReadonlyArray<number>,
  period: number = 20
): Effect.Effect<SMAResult> =>
  Effect.sync(() => calculateSMA(prices, period));

/**
 * Effect-based wrapper for SMA from CryptoPrice
 */
export const computeSMAFromPrice = (
  price: CryptoPrice,
  period: number = 20
): Effect.Effect<SMAResult> => {
  // For single price point, we approximate using 24h data
  const prices = price.high24h && price.low24h
    ? [price.low24h, price.price, price.high24h]
    : [price.price];

  return computeSMA(prices, Math.min(period, prices.length));
};

/**
 * Pure function to calculate Exponential Moving Average
 * @param prices - Array of prices
 * @param period - Number of periods for the average
 * @param previousEMA - Previous EMA value (optional, uses SMA as seed)
 */
export const calculateEMA = (
  prices: ReadonlyArray<number>,
  period: number = 20,
  previousEMA?: number
): EMAResult => {
  const alpha = emaAlpha(period);

  // If no previous EMA, use SMA as the seed
  let ema = previousEMA ?? mean([...prices.slice(0, period)]);

  // Calculate EMA for all prices
  for (let i = (previousEMA ? 0 : period); i < prices.length; i++) {
    ema = prices[i] * alpha + ema * (1 - alpha);
  }

  return {
    value: ema,
    period,
    alpha,
  };
};

/**
 * Pure function to calculate EMA for each point in a series
 * Returns an array of EMA values
 */
export const calculateEMASeries = (
  prices: ReadonlyArray<number>,
  period: number = 20
): ReadonlyArray<number> => {
  const alpha = emaAlpha(period);
  const result: number[] = [];

  // Use SMA as the seed for the first EMA value
  let ema = mean([...prices.slice(0, period)]);
  result.push(ema);

  // Calculate EMA for remaining prices
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * alpha + ema * (1 - alpha);
    result.push(ema);
  }

  return result;
};

/**
 * Effect-based wrapper for EMA calculation
 */
export const computeEMA = (
  prices: ReadonlyArray<number>,
  period: number = 20,
  previousEMA?: number
): Effect.Effect<EMAResult> =>
  Effect.sync(() => calculateEMA(prices, period, previousEMA));

/**
 * Effect-based wrapper for EMA from CryptoPrice
 */
export const computeEMAFromPrice = (
  price: CryptoPrice,
  period: number = 20
): Effect.Effect<EMAResult> => {
  // For single price point, we approximate using 24h data
  const prices = price.high24h && price.low24h
    ? [price.low24h, price.price, price.high24h]
    : [price.price];

  return computeEMA(prices, Math.min(period, prices.length));
};

// ============================================================================
// FORMULA METADATA FOR AI DISCOVERY
// ============================================================================

export const SMAMetadata: FormulaMetadata = {
  name: "SMA",
  category: "trend",
  difficulty: "beginner",
  description: "Simple Moving Average - arithmetic mean of prices over N periods",
  requiredInputs: ["prices"],
  optionalInputs: ["period"],
  minimumDataPoints: 1,
  outputType: "SMAResult",
  useCases: ["trend identification", "support/resistance levels", "smoothing price data"],
  timeComplexity: "O(n)",
  dependencies: [],
};

export const EMAMetadata: FormulaMetadata = {
  name: "EMA",
  category: "trend",
  difficulty: "beginner",
  description:
    "Exponential Moving Average - weighted average giving more weight to recent prices",
  requiredInputs: ["prices"],
  optionalInputs: ["period", "previousEMA"],
  minimumDataPoints: 1,
  outputType: "EMAResult",
  useCases: [
    "trend identification",
    "faster response to price changes",
    "foundation for MACD and other indicators",
  ],
  timeComplexity: "O(n)",
  dependencies: [],
};
