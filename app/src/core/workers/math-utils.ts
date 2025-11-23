export const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

export const standardDeviation = (values: number[]): number => {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  return Math.sqrt(mean(squareDiffs));
};

export const variance = (values: number[]): number => {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  return mean(squareDiffs);
};

export const sum = (values: number[]): number => {
  return values.reduce((acc, val) => acc + val, 0);
};

export const max = (values: number[]): number => {
  return Math.max(...values);
};

export const min = (values: number[]): number => {
  return Math.min(...values);
};
