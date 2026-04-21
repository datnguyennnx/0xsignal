import type { Candle, CoverageResult } from "../../schemas/market-data";

export const MAX_RANGE_CANDLES = 10_000;
export const MAX_RECENT_CANDLES = 5000;
export const DEFAULT_RECENT_CANDLES = 300;

export const isCoverageCompleteStrict = (coverage: CoverageResult): boolean =>
  coverage.fullCoverage &&
  coverage.missingWindows.length === 0 &&
  coverage.rowCount >= coverage.expectedCount;

export const normalizeCandles = (candles: Candle[]): Candle[] => {
  const hasOnlyValidTimestamps = candles.every(
    (candle) => candle.timestamp instanceof Date && Number.isFinite(candle.timestamp.getTime())
  );

  if (!hasOnlyValidTimestamps) {
    return candles;
  }

  const byTimestamp = new Map<number, Candle>();
  for (const candle of candles) {
    byTimestamp.set(candle.timestamp.getTime(), candle);
  }

  return Array.from(byTimestamp.entries())
    .sort(([left], [right]) => left - right)
    .map(([, candle]) => candle);
};
