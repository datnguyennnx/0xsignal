export const mean = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((acc, val) => acc + val, 0) / values.length;
};

export const getTrueRange = (high: number, low: number, previousClose: number): number => {
  const range1 = high - low;
  const range2 = Math.abs(high - previousClose);
  const range3 = Math.abs(low - previousClose);
  return Math.max(range1, range2, range3);
};
