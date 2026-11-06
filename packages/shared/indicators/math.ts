export const getTrueRange = (high: number, low: number, previousClose: number): number => {
  const range1 = high - low;
  const range2 = Math.abs(high - previousClose);
  const range3 = Math.abs(low - previousClose);
  return Math.max(range1, range2, range3);
};
