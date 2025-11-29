/** Breakout Strategy - Low volatility periods preceding large moves */

import { Effect, Match, pipe } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategySignal } from "./types";
import { detectSqueeze } from "../formulas/volatility/bollinger-bands";
import { computeATR } from "../formulas/volatility/atr";
import { computeVolumeROC } from "../formulas/volume/volume-roc";
import { computeDonchianChannels } from "../formulas/volatility/donchian-channels";
import { computeADX } from "../formulas/trend/adx";

// Price array preparation
const preparePrices = (price: CryptoPrice) => ({
  closes:
    price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price],
  highs: price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price],
  lows: price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price],
  volumes: price.volume24h ? [price.volume24h, price.volume24h] : [price.volume24h],
});

// Breakout direction to score multiplier
const breakoutDirectionScore = Match.type<"BULLISH" | "BEARISH" | "NEUTRAL">().pipe(
  Match.when("BULLISH", () => 1),
  Match.when("BEARISH", () => -1),
  Match.orElse(() => 0)
);

// Donchian position to score
const donchianPositionScore = Match.type<number>().pipe(
  Match.when(
    (p) => p > 0.8,
    () => 30
  ),
  Match.when(
    (p) => p < 0.2,
    () => -30
  ),
  Match.orElse(() => 0)
);

// Volume ROC contribution
const volumeContribution = (volumeROC: number, priceChange: number): number =>
  pipe(
    Match.value(volumeROC),
    Match.when(
      (v) => v > 20,
      () => 20 * (priceChange > 0 ? 1 : -1)
    ),
    Match.orElse(() => 0)
  );

// ATR volatility contribution
const atrContribution = (volatilityLevel: string, priceChange: number): number =>
  pipe(
    Match.value(volatilityLevel),
    Match.when(
      (v) => v === "HIGH" || v === "VERY_HIGH",
      () => 10 * (priceChange > 0 ? 1 : -1)
    ),
    Match.orElse(() => 0)
  );

// Score to signal
const scoreToSignal = Match.type<number>().pipe(
  Match.when(
    (s) => s > 60,
    () => "STRONG_BUY" as const
  ),
  Match.when(
    (s) => s > 20,
    () => "BUY" as const
  ),
  Match.when(
    (s) => s < -60,
    () => "STRONG_SELL" as const
  ),
  Match.when(
    (s) => s < -20,
    () => "SELL" as const
  ),
  Match.orElse(() => "HOLD" as const)
);

// Squeeze insight
const squeezeInsight = (isSqueezing: boolean, intensity: number, direction: string): string[] =>
  pipe(
    Match.value({ isSqueezing, direction }),
    Match.when(
      ({ isSqueezing }) => isSqueezing,
      ({ direction }) => {
        const base = [`Bollinger Squeeze detected (${intensity}% intensity)`];
        return direction !== "NEUTRAL"
          ? [...base, `potential ${direction.toLowerCase()} breakout`]
          : base;
      }
    ),
    Match.orElse(() => ["no squeeze pattern detected"])
  );

// Volume insight
const volumeInsight = Match.type<string>().pipe(
  Match.when("SURGE", () => "strong volume surge"),
  Match.when("HIGH", () => "increasing volume"),
  Match.orElse(() => null)
);

// ATR insight
const atrInsight = Match.type<string>().pipe(
  Match.when(
    (v) => v === "HIGH" || v === "VERY_HIGH",
    () => "volatility expanding"
  ),
  Match.when(
    (v) => v === "LOW" || v === "VERY_LOW",
    () => "volatility contracting"
  ),
  Match.orElse(() => null)
);

// Donchian insight
const donchianInsight = Match.type<number>().pipe(
  Match.when(
    (p) => p > 0.8,
    () => "price near upper channel"
  ),
  Match.when(
    (p) => p < 0.2,
    () => "price near lower channel"
  ),
  Match.orElse(() => null)
);

// Build reasoning
const buildReasoning = (
  squeeze: { isSqueezing: boolean; squeezeIntensity: number; breakoutDirection: string },
  volumeSignal: string,
  volatilityLevel: string,
  donchianPosition: number
): string => {
  const parts = [
    ...squeezeInsight(squeeze.isSqueezing, squeeze.squeezeIntensity, squeeze.breakoutDirection),
    volumeInsight(volumeSignal),
    atrInsight(volatilityLevel),
    donchianInsight(donchianPosition),
  ].filter((p): p is string => p !== null);
  return parts.join(", ");
};

// Identifies potential breakouts from consolidation patterns
export const breakoutStrategy = (price: CryptoPrice): Effect.Effect<StrategySignal, never> =>
  Effect.gen(function* () {
    const { closes, highs, lows, volumes } = preparePrices(price);

    const [squeeze, atr, volumeROC, donchian, adx] = yield* Effect.all(
      [
        detectSqueeze(price),
        computeATR(highs, lows, closes),
        computeVolumeROC(volumes),
        computeDonchianChannels(highs, lows, closes),
        computeADX(highs, lows, closes),
      ],
      { concurrency: "unbounded" }
    );

    // Calculate score using pattern matching
    const squeezeScore = squeeze.isSqueezing
      ? (squeeze.squeezeIntensity / 100) *
        40 *
        breakoutDirectionScore(squeeze.breakoutDirection as any)
      : 0;

    const score = Math.max(
      -100,
      Math.min(
        100,
        squeezeScore +
          donchianPositionScore(donchian.position) +
          volumeContribution(volumeROC.value, price.change24h) +
          atrContribution(atr.volatilityLevel, price.change24h)
      )
    );

    const confidence = Math.min(
      100,
      Math.round(
        squeeze.squeezeIntensity * 0.5 +
          Math.min(volumeROC.value, 100) * 0.3 +
          Math.abs(score) * 0.2
      )
    );

    return {
      strategy: "BREAKOUT",
      signal: scoreToSignal(score),
      confidence,
      reasoning: buildReasoning(squeeze, volumeROC.signal, atr.volatilityLevel, donchian.position),
      metrics: {
        squeezeIntensity: squeeze.squeezeIntensity,
        atr: atr.value,
        normalizedATR: atr.normalizedATR,
        volumeROC: volumeROC.value,
        donchianPosition: donchian.position,
        adxValue: adx.adx,
      },
    };
  });
