/** Bollinger Bands - Volatility Analysis */
// Upper = SMA + 2σ, Lower = SMA - 2σ, %B = (Price - Lower) / (Upper - Lower)

import { Effect, Match, Option, pipe } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";

export interface BollingerBandsResult {
  readonly upperBand: number;
  readonly middleBand: number;
  readonly lowerBand: number;
  readonly bandwidth: number;
  readonly percentB: number;
}

export interface BollingerSqueezeSignal {
  readonly symbol: string;
  readonly isSqueezing: boolean;
  readonly bandwidth: number;
  readonly squeezeIntensity: number;
  readonly breakoutDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
  readonly confidence: number;
}

// Default bands when no range data available
const defaultBands = (price: number): BollingerBandsResult => ({
  upperBand: price * 1.1,
  middleBand: price,
  lowerBand: price * 0.9,
  bandwidth: 0.2,
  percentB: 0.5,
});

// Calculate bands from price range
const calculateBandsFromRange = (
  currentPrice: number,
  high24h: number,
  low24h: number
): BollingerBandsResult => {
  const middleBand = (high24h + low24h + currentPrice) / 3;
  const variance =
    Math.pow(high24h - middleBand, 2) +
    Math.pow(low24h - middleBand, 2) +
    Math.pow(currentPrice - middleBand, 2);
  const stdDev = Math.sqrt(variance / 3);
  const upperBand = middleBand + 2 * stdDev;
  const lowerBand = middleBand - 2 * stdDev;

  return {
    upperBand,
    middleBand,
    lowerBand,
    bandwidth: (upperBand - lowerBand) / middleBand,
    percentB: (currentPrice - lowerBand) / (upperBand - lowerBand),
  };
};

// Calculate Bollinger Bands
export const calculateBollingerBands = (
  currentPrice: number,
  high24h: number | undefined,
  low24h: number | undefined
): BollingerBandsResult =>
  pipe(
    Option.all({ high: Option.fromNullable(high24h), low: Option.fromNullable(low24h) }),
    Option.map(({ high, low }) => calculateBandsFromRange(currentPrice, high, low)),
    Option.getOrElse(() => defaultBands(currentPrice))
  );

// Effect-based wrapper
export const computeBollingerBands = (price: CryptoPrice): Effect.Effect<BollingerBandsResult> =>
  Effect.sync(() => calculateBollingerBands(price.price, price.high24h, price.low24h));

// Breakout direction classification
const classifyBreakoutDirection = (
  percentB: number
): { direction: "BULLISH" | "BEARISH" | "NEUTRAL"; confidence: number } =>
  pipe(
    Match.value(percentB),
    Match.when(
      (p) => p > 0.6,
      (p) => ({
        direction: "BULLISH" as const,
        confidence: Math.min(100, 60 + Math.round((p - 0.6) * 100)),
      })
    ),
    Match.when(
      (p) => p < 0.4,
      (p) => ({
        direction: "BEARISH" as const,
        confidence: Math.min(100, 60 + Math.round((0.4 - p) * 100)),
      })
    ),
    Match.orElse(() => ({ direction: "NEUTRAL" as const, confidence: 50 }))
  );

// Detect Bollinger Band squeeze
export const detectBollingerSqueeze = (
  price: CryptoPrice,
  bb: BollingerBandsResult
): BollingerSqueezeSignal => {
  const squeezeThreshold = 0.1;
  const isSqueezing = bb.bandwidth < squeezeThreshold;
  const squeezeIntensity = isSqueezing
    ? Math.round((1 - bb.bandwidth / squeezeThreshold) * 100)
    : 0;

  const { direction, confidence } = isSqueezing
    ? classifyBreakoutDirection(bb.percentB)
    : { direction: "NEUTRAL" as const, confidence: 50 };

  return {
    symbol: price.symbol,
    isSqueezing,
    bandwidth: bb.bandwidth,
    squeezeIntensity,
    breakoutDirection: direction,
    confidence,
  };
};

// Effect-based squeeze detection
export const detectSqueeze = (price: CryptoPrice): Effect.Effect<BollingerSqueezeSignal> =>
  Effect.gen(function* () {
    const bb = yield* computeBollingerBands(price);
    return detectBollingerSqueeze(price, bb);
  });
