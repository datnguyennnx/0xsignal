/** EMA (Exponential Moving Average) - Core calculation */

import { Effect } from "effect";

export interface CoreEMAResult {
  readonly values: readonly number[];
  readonly current: number;
  readonly period: number;
}

const calculateEMAValues = (closes: readonly number[], period: number): number[] => {
  if (closes.length < period) {
    return [];
  }

  const k = 2 / (period + 1);
  const result: number[] = [];

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += closes[i];
  }
  result.push(sum / period);

  for (let i = period; i < closes.length; i++) {
    const ema = closes[i] * k + result[result.length - 1] * (1 - k);
    result.push(ema);
  }

  return result;
};

export const computeCoreEMA = (
  closes: readonly number[],
  period: number
): Effect.Effect<CoreEMAResult> =>
  Effect.sync(() => {
    const values = calculateEMAValues(closes, period);
    return {
      values,
      current: values.length > 0 ? values[values.length - 1] : 0,
      period,
    };
  });
