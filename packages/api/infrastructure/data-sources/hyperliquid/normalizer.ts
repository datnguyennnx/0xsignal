import { Data, Effect, Match } from "effect";
import { type Candle, type WsMarketInterval } from "@0xsignal/shared";
import type { MarketTimeframe } from "../../../domain/market-data/timeframe";

export class NormalizationError extends Data.TaggedError("NormalizationError")<{
  readonly message: string;
}> {}

export type HlInterval = WsMarketInterval;

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
  if (typeof value !== "object" || value === null) return false;
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

export function parseHlRawCandles(
  payload: unknown,
): Effect.Effect<HlRawCandle[], NormalizationError> {
  if (!Array.isArray(payload)) {
    return Effect.fail(
      new NormalizationError({ message: "Hyperliquid candle payload must be an array" }),
    );
  }
  const parsed: HlRawCandle[] = [];
  for (const item of payload) {
    if (!isHlRawCandle(item)) {
      return Effect.fail(
        new NormalizationError({ message: "Hyperliquid candle item has invalid shape" }),
      );
    }
    parsed.push(item);
  }
  return Effect.succeed(parsed);
}

export function toHlInterval(timeframe: MarketTimeframe): HlInterval {
  return Match.value(timeframe).pipe(
    Match.when("1m", () => "1m" as const),
    Match.when("3m", () => "3m" as const),
    Match.when("5m", () => "5m" as const),
    Match.when("15m", () => "15m" as const),
    Match.when("30m", () => "30m" as const),
    Match.when("1h", () => "1h" as const),
    Match.when("2h", () => "2h" as const),
    Match.when("4h", () => "4h" as const),
    Match.when("8h", () => "8h" as const),
    Match.when("12h", () => "12h" as const),
    Match.when("1d", () => "1d" as const),
    Match.when("1w", () => "1w" as const),
    Match.exhaustive,
  );
}

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
