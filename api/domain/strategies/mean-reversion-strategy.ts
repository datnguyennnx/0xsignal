/** Mean Reversion Strategy - Range-bound markets with price extremes */

import { Effect, Match, pipe } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategySignal } from "./types";
import { computePercentB } from "../formulas/mean-reversion/percent-b";
import { computeDistanceFromMA } from "../formulas/mean-reversion/distance-from-ma";
import { computeRSI } from "../formulas/momentum/rsi";
import { computeStochastic } from "../formulas/momentum/stochastic";
import { computeADX } from "../formulas/trend/adx";
import { computeATR } from "../formulas/volatility/atr";
import { computeMACDFromPrice } from "../formulas/momentum/macd";
import { calculateIndicatorAgreement, calculateConfidence } from "../analysis/scoring";

type IndicatorSignal = { signal: "BUY" | "SELL" | "NEUTRAL"; weight: number };

// Price array preparation
const preparePrices = (price: CryptoPrice) => ({
  closes:
    price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price],
  highs: price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price],
  lows: price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price],
});

// RSI to signal using Match
const rsiToSignal = Match.type<number>().pipe(
  Match.when(
    (r) => r < 45,
    () => "BUY" as const
  ),
  Match.when(
    (r) => r > 55,
    () => "SELL" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Stochastic to signal using Match
const stochToSignal = Match.type<number>().pipe(
  Match.when(
    (s) => s < 40,
    () => "BUY" as const
  ),
  Match.when(
    (s) => s > 60,
    () => "SELL" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Percent B to signal using Match
const percentBToSignal = Match.type<number>().pipe(
  Match.when(
    (p) => p < 0.4,
    () => "BUY" as const
  ),
  Match.when(
    (p) => p > 0.6,
    () => "SELL" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// MACD trend to signal using Match
const macdToSignal = Match.type<string>().pipe(
  Match.when("BULLISH", () => "BUY" as const),
  Match.when("BEARISH", () => "SELL" as const),
  Match.orElse(() => "NEUTRAL" as const)
);

// Distance from MA to signal using Match
const distanceToSignal = Match.type<number>().pipe(
  Match.when(
    (d) => d < -1,
    () => "BUY" as const
  ),
  Match.when(
    (d) => d > 1,
    () => "SELL" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Price change to signal using Match
const priceChangeToSignal = Match.type<number>().pipe(
  Match.when(
    (c) => c > 1,
    () => "BUY" as const
  ),
  Match.when(
    (c) => c < -1,
    () => "SELL" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Score to signal using Match
const scoreToSignal = Match.type<number>().pipe(
  Match.when(
    (s) => s > 50,
    () => "STRONG_BUY" as const
  ),
  Match.when(
    (s) => s > 15,
    () => "BUY" as const
  ),
  Match.when(
    (s) => s < -50,
    () => "STRONG_SELL" as const
  ),
  Match.when(
    (s) => s < -15,
    () => "SELL" as const
  ),
  Match.orElse(() => "HOLD" as const)
);

// Signal to score contribution
const signalToScore = Match.type<"BUY" | "SELL" | "NEUTRAL">().pipe(
  Match.when("BUY", () => 1),
  Match.when("SELL", () => -1),
  Match.orElse(() => 0)
);

// Calculate weighted score from signals
const calculateWeightedScore = (signals: IndicatorSignal[]): number =>
  signals.reduce((score, { signal, weight }) => score + signalToScore(signal) * weight, 0);

// Effective stochastic value (use RSI as proxy at extremes)
const getEffectiveStoch = (stochK: number, rsiValue: number): number =>
  pipe(
    Match.value(stochK),
    Match.when(
      (k) => k === 100 || k === 0,
      () => rsiValue
    ),
    Match.orElse(() => stochK)
  );

// Agreement level description
const agreementDescription = Match.type<number>().pipe(
  Match.when(
    (a) => a >= 70,
    (a) => `strong indicator consensus (${a}%)`
  ),
  Match.when(
    (a) => a >= 50,
    (a) => `moderate indicator agreement (${a}%)`
  ),
  Match.orElse((a) => `mixed signals (${a}% agreement)`)
);

// RSI insight
const rsiInsight = Match.type<number>().pipe(
  Match.when(
    (r) => r < 35,
    (r) => `RSI oversold (${Math.round(r)})`
  ),
  Match.when(
    (r) => r > 65,
    (r) => `RSI overbought (${Math.round(r)})`
  ),
  Match.orElse(() => null)
);

// MACD insight
const macdInsight = Match.type<string>().pipe(
  Match.when("BULLISH", () => "MACD bullish"),
  Match.when("BEARISH", () => "MACD bearish"),
  Match.orElse(() => null)
);

// Percent B insight
const percentBInsight = Match.type<number>().pipe(
  Match.when(
    (p) => p < 0.25,
    () => "near lower BB"
  ),
  Match.when(
    (p) => p > 0.75,
    () => "near upper BB"
  ),
  Match.orElse(() => null)
);

// Build reasoning from insights
const buildReasoning = (
  agreement: number,
  rsi: number,
  macdTrend: string,
  percentBValue: number
): string => {
  const agreementPct = Math.round(agreement * 100);
  const parts = [
    agreementDescription(agreementPct),
    rsiInsight(rsi),
    macdInsight(macdTrend),
    percentBInsight(percentBValue),
  ].filter((p): p is string => p !== null);
  return parts.join(", ");
};

// Multi-indicator consensus for balanced buy/sell signals
export const meanReversionStrategy = (price: CryptoPrice): Effect.Effect<StrategySignal, never> =>
  Effect.gen(function* () {
    const { closes, highs, lows } = preparePrices(price);

    const [percentB, distanceFromMA, rsi, stochastic, adx, atr, macd] = yield* Effect.all(
      [
        computePercentB(price),
        computeDistanceFromMA(price),
        computeRSI(price),
        computeStochastic(closes, highs, lows),
        computeADX(highs, lows, closes),
        computeATR(highs, lows, closes),
        computeMACDFromPrice(price),
      ],
      { concurrency: "unbounded" }
    );

    const effectiveStoch = getEffectiveStoch(stochastic.k, rsi.rsi);

    const signals: IndicatorSignal[] = [
      { signal: rsiToSignal(rsi.rsi), weight: 25 },
      { signal: stochToSignal(effectiveStoch), weight: 20 },
      { signal: percentBToSignal(percentB.value), weight: 20 },
      { signal: macdToSignal(macd.trend), weight: 20 },
      { signal: distanceToSignal(distanceFromMA.distance), weight: 10 },
      { signal: priceChangeToSignal(price.change24h), weight: 15 },
    ];

    const { agreement } = calculateIndicatorAgreement(signals);
    const rawScore = calculateWeightedScore(signals);
    const score = Math.round(rawScore);

    return {
      strategy: "MEAN_REVERSION",
      signal: scoreToSignal(score),
      confidence: calculateConfidence(score, agreement, adx.adx, atr.normalizedATR),
      reasoning: buildReasoning(agreement, rsi.rsi, macd.trend, percentB.value),
      metrics: {
        percentB: Math.round(percentB.value * 100) / 100,
        distanceFromMA: Math.round(distanceFromMA.distance * 100) / 100,
        rsi: Math.round(rsi.rsi),
        stochastic: Math.round(stochastic.k),
        adxValue: Math.round(adx.adx),
        normalizedATR: Math.round(atr.normalizedATR * 100) / 100,
        macdTrend:
          macdToSignal(macd.trend) === "BUY" ? 1 : macdToSignal(macd.trend) === "SELL" ? -1 : 0,
        indicatorAgreement: Math.round(agreement * 100),
      },
    };
  });
