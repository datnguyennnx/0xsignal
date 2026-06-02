import { type Candle } from "@0xsignal/shared";
import type { MarketTimeframe } from "../../../domain/market-data/timeframe";

class NormalizationError extends Error {
  readonly _tag = "NormalizationError";
  constructor(message: string) {
    super(message);
    this.name = "NormalizationError";
  }
}

export type HlInterval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "8h"
  | "12h"
  | "1d"
  | "1w";

export interface HlRawCandle {
  readonly t: number | string;
  readonly o: number | string;
  readonly h: number | string;
  readonly l: number | string;
  readonly c: number | string;
  readonly v: number | string;
}

const isNumberOrString = (value: unknown): value is number | string =>
  typeof value === "number" || typeof value === "string";

const isHlRawCandle = (value: unknown): value is HlRawCandle => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candle = value as Record<string, unknown>;
  return (
    isNumberOrString(candle.t) &&
    isNumberOrString(candle.o) &&
    isNumberOrString(candle.h) &&
    isNumberOrString(candle.l) &&
    isNumberOrString(candle.c) &&
    isNumberOrString(candle.v)
  );
};

export function parseHlRawCandles(payload: unknown): HlRawCandle[] {
  if (!Array.isArray(payload)) {
    throw new NormalizationError("Hyperliquid candle payload must be an array");
  }

  const parsed: HlRawCandle[] = [];
  for (const item of payload) {
    if (!isHlRawCandle(item)) {
      throw new NormalizationError("Hyperliquid candle item has invalid shape");
    }
    parsed.push(item);
  }

  return parsed;
}

/**
 * Maps internal timeframe to Hyperliquid SDK interval strings.
 */
export function toHlInterval(timeframe: MarketTimeframe): HlInterval {
  switch (timeframe) {
    case "1m":
      return "1m";
    case "5m":
      return "5m";
    case "3m":
      return "3m";
    case "15m":
      return "15m";
    case "30m":
      return "30m";
    case "1h":
      return "1h";
    case "2h":
      return "2h";
    case "4h":
      return "4h";
    case "8h":
      return "8h";
    case "12h":
      return "12h";
    case "1d":
      return "1d";
    case "1w":
      return "1w";
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
