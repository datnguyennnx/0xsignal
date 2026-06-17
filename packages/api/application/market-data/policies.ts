import type { Candle } from "@0xsignal/shared";

export const MAX_RANGE_CANDLES = 10_000;
export const MAX_RECENT_CANDLES = 5000;
export const DEFAULT_RECENT_CANDLES = 300;

const toTimestampMs = (ts: Date | string | number): number =>
  ts instanceof Date ? ts.getTime() : typeof ts === "string" ? new Date(ts).getTime() : ts;

export const normalizeCandles = (candles: Candle[]): Candle[] => {
  // Single pass: filter valid timestamps + deduplicate by timestamp (last-write-wins)
  const byTimestamp = new Map<number, Candle>();
  for (const candle of candles) {
    const ts = toTimestampMs(candle.timestamp);
    if (!isNaN(ts)) {
      byTimestamp.set(ts, candle);
    }
  }
  // If nothing survived dedup, return first candle as-is (preserves original behavior)
  if (byTimestamp.size === 0) {
    return candles.length > 0 ? candles : [];
  }
  // Sort by timestamp once
  return Array.from(byTimestamp.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
};
