// ============================================================================
// MATHEMATICAL UTILITIES
// ============================================================================
// Shared mathematical functions used across formulas
// Pure functions with no side effects
// ============================================================================

/**
 * Calculate the sum of an array
 */
export const sum = (values: number[]): number => {
  return values.reduce((acc, val) => acc + val, 0);
};

/**
 * Calculate the mean (average) of an array
 */
export const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
};

/**
 * Calculate the variance of an array
 * @param values - Array of numbers
 * @param sample - If true, use sample variance (n-1), otherwise population variance (n)
 */
export const variance = (values: number[], sample: boolean = false): number => {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - avg, 2));
  const divisor = sample ? values.length - 1 : values.length;
  return sum(squaredDiffs) / divisor;
};

/**
 * Calculate the standard deviation of an array
 * @param values - Array of numbers
 * @param sample - If true, use sample std dev (n-1), otherwise population std dev (n)
 */
export const standardDeviation = (values: number[], sample: boolean = false): number => {
  return Math.sqrt(variance(values, sample));
};

/**
 * Calculate the covariance between two arrays
 */
export const covariance = (x: number[], y: number[]): number => {
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
 * Calculate the Pearson correlation coefficient between two arrays
 */
export const correlation = (x: number[], y: number[]): number => {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const cov = covariance(x, y);
  const stdX = standardDeviation(x);
  const stdY = standardDeviation(y);
  
  if (stdX === 0 || stdY === 0) return 0;
  
  return cov / (stdX * stdY);
};

/**
 * Calculate the minimum value in an array
 */
export const min = (values: number[]): number => {
  if (values.length === 0) return 0;
  return Math.min(...values);
};

/**
 * Calculate the maximum value in an array
 */
export const max = (values: number[]): number => {
  if (values.length === 0) return 0;
  return Math.max(...values);
};

/**
 * Calculate the median of an array
 */
export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

/**
 * Calculate the percentile of an array
 * @param values - Array of numbers
 * @param percentile - Percentile to calculate (0-100)
 */
export const percentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  if (percentile < 0 || percentile > 100) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  if (lower === upper) {
    return sorted[lower];
  }
  
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

/**
 * Calculate log returns from prices
 */
export const logReturns = (prices: number[]): number[] => {
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
export const simpleReturns = (prices: number[]): number[] => {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    } else {
      returns.push(0);
    }
  }
  return returns;
};

/**
 * Calculate a rolling window of values
 * @param values - Array of numbers
 * @param windowSize - Size of the rolling window
 * @param fn - Function to apply to each window
 */
export const rollingWindow = <T>(
  values: number[],
  windowSize: number,
  fn: (window: number[]) => T
): T[] => {
  const results: T[] = [];
  
  for (let i = windowSize - 1; i < values.length; i++) {
    const window = values.slice(i - windowSize + 1, i + 1);
    results.push(fn(window));
  }
  
  return results;
};

/**
 * Clamp a value between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Calculate the exponential moving average smoothing factor
 * @param period - Number of periods
 */
export const emaAlpha = (period: number): number => {
  return 2 / (period + 1);
};

/**
 * Normalize a value to 0-1 range
 */
export const normalize = (value: number, min: number, max: number): number => {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
};

/**
 * Calculate the z-score (standardized score)
 */
export const zScore = (value: number, mean: number, stdDev: number): number => {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
};
