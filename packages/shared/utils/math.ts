/**
 * Pure mathematical utilities shared between frontend and backend
 * All functions are pure with no side effects
 */

/**
 * Calculate the sum of an array
 */
export const sum = (values: readonly number[]): number => values.reduce((acc, val) => acc + val, 0);

/**
 * Calculate the mean (average) of an array
 */
export const mean = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
};

/**
 * Calculate the variance of an array
 * @param sample - If true, use sample variance (n-1), otherwise population variance (n)
 */
export const variance = (values: readonly number[], sample = false): number => {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
  const divisor = sample ? values.length - 1 : values.length;
  return sum(squaredDiffs) / divisor;
};

/**
 * Calculate the standard deviation of an array
 * @param sample - If true, use sample std dev (n-1), otherwise population std dev (n)
 */
export const standardDeviation = (values: readonly number[], sample = false): number =>
  Math.sqrt(variance(values, sample));

/**
 * Calculate the covariance between two arrays
 */
export const covariance = (x: readonly number[], y: readonly number[]): number => {
  if (x.length !== y.length || x.length === 0) return 0;
  const meanX = mean(x);
  const meanY = mean(y);
  let cov = 0;
  for (let i = 0; i < x.length; i++) {
    cov += (x[i] - meanX) * (y[i] - meanY);
  }
  return cov / x.length;
};

/**
 * Calculate the Pearson correlation coefficient
 */
export const correlation = (x: readonly number[], y: readonly number[]): number => {
  if (x.length !== y.length || x.length === 0) return 0;
  const cov = covariance(x, y);
  const stdX = standardDeviation([...x]);
  const stdY = standardDeviation([...y]);
  if (stdX === 0 || stdY === 0) return 0;
  return cov / (stdX * stdY);
};

/**
 * Calculate the minimum value in an array
 */
export const min = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  return Math.min(...values);
};

/**
 * Calculate the maximum value in an array
 */
export const max = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  return Math.max(...values);
};

/**
 * Calculate the median of an array
 */
export const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

/**
 * Calculate the percentile of an array
 * @param percentile - Percentile to calculate (0-100)
 */
export const percentile = (values: readonly number[], pct: number): number => {
  if (values.length === 0 || pct < 0 || pct > 100) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (pct / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return lower === upper ? sorted[lower] : sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

/**
 * Calculate log returns from prices
 */
export const logReturns = (prices: readonly number[]): number[] => {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    } else {
      returns.push(0);
    }
  }
  return returns;
};

/**
 * Calculate simple returns from prices
 */
export const simpleReturns = (prices: readonly number[]): number[] => {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(prices[i - 1] !== 0 ? (prices[i] - prices[i - 1]) / prices[i - 1] : 0);
  }
  return returns;
};

/**
 * Calculate a rolling window of values
 */
export const rollingWindow = <T>(
  values: readonly number[],
  windowSize: number,
  fn: (window: number[]) => T
): T[] => {
  const results: T[] = [];
  for (let i = windowSize - 1; i < values.length; i++) {
    const window = values.slice(i - windowSize + 1, i + 1);
    results.push(fn([...window]));
  }
  return results;
};

/**
 * Clamp a value between min and max
 */
export const clamp = (value: number, minVal: number, maxVal: number): number =>
  Math.min(Math.max(value, minVal), maxVal);

/**
 * Calculate the EMA smoothing factor (alpha)
 */
export const emaAlpha = (period: number): number => 2 / (period + 1);

/**
 * Normalize a value to 0-1 range
 */
export const normalize = (value: number, minVal: number, maxVal: number): number => {
  if (maxVal === minVal) return 0.5;
  return (value - minVal) / (maxVal - minVal);
};

/**
 * Calculate the z-score (standardized score)
 */
export const zScore = (value: number, avg: number, stdDev: number): number => {
  if (stdDev === 0) return 0;
  return (value - avg) / stdDev;
};
