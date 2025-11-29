/** Momentum Strategy - Trend-following signals */

import { Effect, Match } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategySignal } from "./types";
import { computeIndicators } from "../analysis/indicators";
import {
  scoreToSignal,
  calculateIndicatorAgreement,
  calculateConfidence,
} from "../analysis/scoring";

type IndicatorSignal = { signal: "BUY" | "SELL" | "NEUTRAL"; weight: number };

// RSI signal classification
const rsiToSignal = Match.type<number>().pipe(
  Match.when(
    (r) => r < 48,
    () => "BUY" as const
  ),
  Match.when(
    (r) => r > 52,
    () => "SELL" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// MACD trend to signal
const macdToSignal = Match.type<string>().pipe(
  Match.when("BULLISH", () => "BUY" as const),
  Match.when("BEARISH", () => "SELL" as const),
  Match.orElse(() => "NEUTRAL" as const)
);

// Price change to signal
const priceToSignal = Match.type<number>().pipe(
  Match.when(
    (c) => c > 0.5,
    () => "BUY" as const
  ),
  Match.when(
    (c) => c < -0.5,
    () => "SELL" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Divergence to signal
const divergenceToSignal = (hasDivergence: boolean, type: string): "BUY" | "SELL" | "NEUTRAL" =>
  !hasDivergence ? "NEUTRAL" : type === "BULLISH" ? "BUY" : type === "BEARISH" ? "SELL" : "NEUTRAL";

// Calculate weighted score
const calculateScore = (signals: IndicatorSignal[]): number =>
  signals.reduce(
    (score, { signal, weight }) =>
      score + (signal === "BUY" ? weight : signal === "SELL" ? -weight : 0),
    0
  );

// Build reasoning
const buildReasoning = (rsi: number, macdTrend: string, adx: number, agreement: number): string => {
  const parts: string[] = [];
  const agreementPct = Math.round(agreement * 100);

  parts.push(
    agreementPct >= 70
      ? `strong consensus (${agreementPct}%)`
      : agreementPct >= 50
        ? `moderate agreement (${agreementPct}%)`
        : `mixed signals (${agreementPct}%)`
  );
  if (rsi < 40) parts.push(`RSI bullish (${Math.round(rsi)})`);
  else if (rsi > 60) parts.push(`RSI bearish (${Math.round(rsi)})`);
  if (macdTrend !== "NEUTRAL") parts.push(`MACD ${macdTrend.toLowerCase()}`);
  if (adx > 40) parts.push("strong trend");
  else if (adx < 20) parts.push("weak trend");

  return parts.join(", ");
};

export const executeMomentumStrategy = (price: CryptoPrice): Effect.Effect<StrategySignal, never> =>
  Effect.gen(function* () {
    const indicators = yield* computeIndicators(price);

    const signals: IndicatorSignal[] = [
      { signal: rsiToSignal(indicators.rsi.rsi), weight: 30 },
      { signal: macdToSignal(indicators.macd.trend), weight: 30 },
      { signal: priceToSignal(price.change24h), weight: 25 },
      {
        signal: divergenceToSignal(
          indicators.divergence.hasDivergence,
          indicators.divergence.divergenceType
        ),
        weight: 15,
      },
    ];

    const { agreement } = calculateIndicatorAgreement(signals);
    const score = calculateScore(signals);

    return {
      strategy: "MOMENTUM",
      signal: scoreToSignal(score),
      confidence: calculateConfidence(
        score,
        agreement,
        indicators.adx.adx,
        indicators.atr.normalizedATR
      ),
      reasoning: buildReasoning(
        indicators.rsi.rsi,
        indicators.macd.trend,
        indicators.adx.adx,
        agreement
      ),
      metrics: {
        rsi: Math.round(indicators.rsi.rsi),
        macdTrend:
          indicators.macd.trend === "BULLISH" ? 1 : indicators.macd.trend === "BEARISH" ? -1 : 0,
        adxValue: Math.round(indicators.adx.adx),
        normalizedATR: Math.round(indicators.atr.normalizedATR * 100) / 100,
        indicatorAgreement: Math.round(agreement * 100),
        priceChange24h: Math.round(price.change24h * 100) / 100,
      },
    };
  });
