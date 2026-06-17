import type { Candle } from "@0xsignal/shared";

export const MAX_RANGE_CANDLES = 10_000;
export const MAX_RECENT_CANDLES = 5000;
export const DEFAULT_RECENT_CANDLES = 300;

export const normalizeCandles = (candles: Candle[]): Candle[] => {
  // Single pass: filter valid timestamps + deduplicate by timestamp (last-write-wins)
  const byTimestamp = new Map<number, Candle>();
  for (const candle of candles) {
    if (candle.timestamp instanceof Date && Number.isFinite(candle.timestamp.getTime())) {
      byTimestamp.set(candle.timestamp.getTime(), candle);
    }
  }
  // If nothing survived dedup, return first candle as-is (preserves original behavior)
  if (byTimestamp.size === 0) {
    return candles.length > 0 &&
      (!(candles[0].timestamp instanceof Date) || !Number.isFinite(candles[0].timestamp.getTime()))
      ? candles
      : [];
  }
  // Sort by timestamp once
  return Array.from(byTimestamp.values()).sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
};
