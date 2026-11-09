import type { ChartDataPoint } from "@0xsignal/shared";

/**
 * Identity for the candle→bar lookup the markers stack against. The last bar's
 * high/low are part of the key: a forming bar can move without changing length
 * or timestamps, and its high anchors the bubble column.
 */
export const candleMapKey = (candles: readonly ChartDataPoint[]): string => {
  const first = candles[0];
  const last = candles.at(-1);
  if (first === undefined || last === undefined) return "0";
  return `${candles.length}:${first.time}:${last.time}:${last.high}:${last.low}`;
};
