import { type Candle } from "@schemas/market-data";
import type { Timeframe } from "../../db/questdb/queries/candle";

export type HlInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface HlRawCandle {
  readonly t: number | string;
  readonly o: number | string;
  readonly h: number | string;
  readonly l: number | string;
  readonly c: number | string;
  readonly v: number | string;
}

/**
 * Maps internal timeframe to Hyperliquid SDK interval strings.
 */
export function toHlInterval(timeframe: Timeframe): HlInterval {
  switch (timeframe) {
    case "1m":
      return "1m";
    case "5m":
      return "5m";
    case "15m":
      return "15m";
    case "1h":
      return "1h";
    case "4h":
      return "4h";
    case "1d":
      return "1d";
  }
}

/**
 * Normalizes Hyperliquid candle response to internal Candle format.
 * Hyperliquid returns: [t, o, h, l, c, v] where o, h, l, c, v are strings.
 */
export function normalizeCandle(hlCandle: HlRawCandle): Candle {
  return {
    timestamp: new Date(hlCandle.t),
    open: Number(hlCandle.o),
    high: Number(hlCandle.h),
    low: Number(hlCandle.l),
    close: Number(hlCandle.c),
    volume: Number(hlCandle.v),
  };
}

export function normalizeCandles(hlCandles: ReadonlyArray<HlRawCandle>): Candle[] {
  return hlCandles.map(normalizeCandle);
}
