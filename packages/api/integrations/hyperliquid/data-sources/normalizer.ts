/// <reference lib="es2023.array" />
import { Data, Effect, Match, Predicate } from "effect";
import type { DecimalString } from "@0xsignal/sdk-hyperliquid";
import type { CandleInterval } from "@0xsignal/sdk-hyperliquid/info";
import { type Candle, type WsMarketInterval } from "@0xsignal/shared";
import type { MarketTimeframe } from "../../../modules/market-data";
import { asRecord } from "../../../shared/parsing";

export class NormalizationError extends Data.TaggedError("NormalizationError")<{
  readonly message: string;
}> {}

export type HlInterval = WsMarketInterval;

export interface HlRawCandle {
  readonly T: number;
  readonly t: number | string;
  readonly o: DecimalString;
  readonly h: DecimalString;
  readonly l: DecimalString;
  readonly c: DecimalString;
  readonly v: DecimalString;
  readonly n: number;
  readonly i: CandleInterval;
  readonly s: string;
}

const isNumberOrString = (value: unknown): value is number | string =>
  Predicate.isNumber(value) || Predicate.isString(value);

const isHlRawCandle = (value: unknown): value is HlRawCandle => {
  const candle = asRecord(value);
  if (candle === null) return false;
  return (
    Predicate.isNumber(candle.T) &&
    isNumberOrString(candle.t) &&
    Predicate.isString(candle.o) &&
    Predicate.isString(candle.h) &&
    Predicate.isString(candle.l) &&
    Predicate.isString(candle.c) &&
    Predicate.isString(candle.v) &&
    Predicate.isNumber(candle.n) &&
    Predicate.isString(candle.i) &&
    Predicate.isString(candle.s)
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
    Match.when("3d", () => "3d" as const),
    Match.when("1w", () => "1w" as const),
    Match.when("1M", () => "1M" as const),
    Match.exhaustive,
  );
}

const MINUTE_MILLIS = 60_000;
const HOUR_MILLIS = 60 * MINUTE_MILLIS;
const DAY_MILLIS = 24 * HOUR_MILLIS;

/** Range width in candles; drives the count-aware `candleSnapshot` weight. */
export function candleCountForRange(
  timeframe: MarketTimeframe,
  startTime: number,
  endTime: number,
): number {
  const intervalMillis = Match.value(timeframe).pipe(
    Match.when("1m", () => MINUTE_MILLIS),
    Match.when("3m", () => 3 * MINUTE_MILLIS),
    Match.when("5m", () => 5 * MINUTE_MILLIS),
    Match.when("15m", () => 15 * MINUTE_MILLIS),
    Match.when("30m", () => 30 * MINUTE_MILLIS),
    Match.when("1h", () => HOUR_MILLIS),
    Match.when("2h", () => 2 * HOUR_MILLIS),
    Match.when("4h", () => 4 * HOUR_MILLIS),
    Match.when("8h", () => 8 * HOUR_MILLIS),
    Match.when("12h", () => 12 * HOUR_MILLIS),
    Match.when("1d", () => DAY_MILLIS),
    Match.when("3d", () => 3 * DAY_MILLIS),
    Match.when("1w", () => 7 * DAY_MILLIS),
    Match.when("1M", () => 30 * DAY_MILLIS),
    Match.exhaustive,
  );
  return Math.max(0, Math.floor((endTime - startTime) / intervalMillis) + 1);
}

export function normalizeCandle(hlCandle: HlRawCandle): Candle {
  return {
    t: Number(hlCandle.t),
    open: hlCandle.o,
    high: hlCandle.h,
    low: hlCandle.l,
    close: hlCandle.c,
    volume: hlCandle.v,
    T: hlCandle.T,
    n: hlCandle.n,
    i: hlCandle.i,
    s: hlCandle.s,
  };
}

export function normalizeCandles(hlCandles: ReadonlyArray<HlRawCandle>): Candle[] {
  // The chart needs ascending, unique open times; a Hyperliquid snapshot may repeat one.
  const byTimestamp = new Map<number, Candle>();
  for (const hlCandle of hlCandles) {
    const candle = normalizeCandle(hlCandle);
    if (Number.isFinite(candle.t)) {
      byTimestamp.set(candle.t, candle);
    }
  }
  return Array.from(byTimestamp.entries())
    .toSorted(([a], [b]) => a - b)
    .map(([, candle]) => candle);
}
