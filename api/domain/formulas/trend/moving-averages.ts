/** Moving Averages - SMA and EMA with functional patterns */
// SMA = Sum(prices) / N, EMA = Price * alpha + EMA_prev * (1 - alpha)

import { Effect, Array as Arr, pipe } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { mean, emaAlpha } from "../core/math";
import type { FormulaMetadata } from "../core/types";

export interface SMAResult {
  readonly value: number;
  readonly period: number;
}

export interface EMAResult {
  readonly value: number;
  readonly period: number;
  readonly alpha: number;
}

// Calculate Simple Moving Average
export const calculateSMA = (prices: ReadonlyArray<number>, period: number = 20): SMAResult => {
  const relevantPrices = Arr.takeRight(prices, period);
  return { value: mean([...relevantPrices]), period };
};

// Calculate SMA series using Arr.makeBy
export const calculateSMASeries = (
  prices: ReadonlyArray<number>,
  period: number = 20
): ReadonlyArray<number> =>
  pipe(
    Arr.makeBy(prices.length - period + 1, (i) => {
      const window = Arr.take(Arr.drop(prices, i), period);
      return mean([...window]);
    })
  );

// Effect-based SMA wrapper
export const computeSMA = (
  prices: ReadonlyArray<number>,
  period: number = 20
): Effect.Effect<SMAResult> => Effect.sync(() => calculateSMA(prices, period));

// Effect-based SMA from CryptoPrice
export const computeSMAFromPrice = (
  price: CryptoPrice,
  period: number = 20
): Effect.Effect<SMAResult> => {
  const prices =
    price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
  return computeSMA(prices, Math.min(period, prices.length));
};

// Calculate Exponential Moving Average using Arr.reduce
export const calculateEMA = (
  prices: ReadonlyArray<number>,
  period: number = 20,
  previousEMA?: number
): EMAResult => {
  const alpha = emaAlpha(period);
  const initialEMA = previousEMA ?? mean([...Arr.take(prices, period)]);
  const startIndex = previousEMA ? 0 : period;
  const pricesToProcess = Arr.drop(prices, startIndex);

  const ema = pipe(
    pricesToProcess,
    Arr.reduce(initialEMA, (acc, price) => price * alpha + acc * (1 - alpha))
  );

  return { value: ema, period, alpha };
};

// Calculate EMA series using Arr.scan
export const calculateEMASeries = (
  prices: ReadonlyArray<number>,
  period: number = 20
): ReadonlyArray<number> => {
  const alpha = emaAlpha(period);
  const initialEMA = mean([...Arr.take(prices, period)]);
  const pricesToProcess = Arr.drop(prices, period);

  return pipe(
    pricesToProcess,
    Arr.scan(initialEMA, (acc, price) => price * alpha + acc * (1 - alpha))
  );
};

// Effect-based EMA wrapper
export const computeEMA = (
  prices: ReadonlyArray<number>,
  period: number = 20,
  previousEMA?: number
): Effect.Effect<EMAResult> => Effect.sync(() => calculateEMA(prices, period, previousEMA));

// Effect-based EMA from CryptoPrice
export const computeEMAFromPrice = (
  price: CryptoPrice,
  period: number = 20
): Effect.Effect<EMAResult> => {
  const prices =
    price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
  return computeEMA(prices, Math.min(period, prices.length));
};

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
  description: "Exponential Moving Average - weighted average giving more weight to recent prices",
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
