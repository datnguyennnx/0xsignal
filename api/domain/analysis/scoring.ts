/** Scoring - Signal and risk calculations */

import { Match, pipe } from "effect";
import type { Signal } from "../types";

// Score to signal using Match
export const scoreToSignal = Match.type<number>().pipe(
  Match.when(
    (n) => n > 60,
    () => "STRONG_BUY" as Signal
  ),
  Match.when(
    (n) => n > 20,
    () => "BUY" as Signal
  ),
  Match.when(
    (n) => n < -60,
    () => "STRONG_SELL" as Signal
  ),
  Match.when(
    (n) => n < -20,
    () => "SELL" as Signal
  ),
  Match.orElse(() => "HOLD" as Signal)
);

// Signal to score using Match
export const signalToScore = Match.type<Signal>().pipe(
  Match.when("STRONG_BUY", () => 100),
  Match.when("BUY", () => 50),
  Match.when("HOLD", () => 0),
  Match.when("SELL", () => -50),
  Match.when("STRONG_SELL", () => -100),
  Match.exhaustive
);

// Regime risk mapping
const regimeRisk: Record<string, number> = {
  HIGH_VOLATILITY: 70,
  BEAR_MARKET: 65,
  SIDEWAYS: 45,
  MEAN_REVERSION: 40,
  TRENDING: 35,
  LOW_VOLATILITY: 30,
  BULL_MARKET: 25,
};

// Volatility adjustment using Match
const volatilityAdjust = Match.type<number>().pipe(
  Match.when(
    (v) => v < 2,
    () => -5
  ),
  Match.when(
    (v) => v > 6,
    () => 15
  ),
  Match.when(
    (v) => v > 4,
    () => 5
  ),
  Match.orElse(() => 0)
);

// Agreement adjustment using Match
const agreementAdjust = Match.type<number | undefined>().pipe(
  Match.when(
    (a) => a !== undefined,
    (a) => (0.5 - a!) * 20
  ),
  Match.orElse(() => 5)
);

// Calculate risk score
export const calculateRiskScore = (
  regime: string,
  confidence: number,
  volatility: number,
  indicatorAgreement?: number
): number => {
  const baseRisk = regimeRisk[regime] ?? 45;
  const confidenceAdj = (50 - confidence) * 0.3;
  const volAdj = volatilityAdjust(volatility);
  const agreementAdj = agreementAdjust(indicatorAgreement);
  return Math.round(Math.max(15, Math.min(85, baseRisk + confidenceAdj + volAdj + agreementAdj)));
};

// Volatility confidence adjustment
const volatilityConfidenceAdjust = Match.type<number>().pipe(
  Match.when(
    (v) => v < 2,
    () => -5
  ),
  Match.when(
    (v) => v > 6,
    () => -10
  ),
  Match.orElse(() => 5)
);

// Calculate confidence
export const calculateConfidence = (
  signalStrength: number,
  indicatorAgreement: number,
  trendStrength: number,
  volatility: number
): number => {
  const strengthConf = Math.abs(signalStrength) * 0.4;
  const agreementBonus = 20 + indicatorAgreement * 30;
  const trendBonus = Math.min(15, trendStrength * 0.4);
  const volAdj = volatilityConfidenceAdjust(volatility);
  return Math.round(
    Math.max(20, Math.min(90, strengthConf + agreementBonus + trendBonus + volAdj))
  );
};

// Signal weight contribution using Match
const signalWeight = Match.type<"BUY" | "SELL" | "NEUTRAL">().pipe(
  Match.when("BUY", () => ({ buy: 1, sell: 0 })),
  Match.when("SELL", () => ({ buy: 0, sell: 1 })),
  Match.orElse(() => ({ buy: 0, sell: 0 }))
);

// Direction from weights using Match
const weightsToDirection = (buyWeight: number, sellWeight: number): "BUY" | "SELL" | "NEUTRAL" =>
  pipe(
    Match.value({ buyWeight, sellWeight }),
    Match.when(
      ({ buyWeight, sellWeight }) => buyWeight > sellWeight,
      () => "BUY" as const
    ),
    Match.when(
      ({ buyWeight, sellWeight }) => sellWeight > buyWeight,
      () => "SELL" as const
    ),
    Match.orElse(() => "NEUTRAL" as const)
  );

// Calculate indicator agreement
export const calculateIndicatorAgreement = (
  indicators: ReadonlyArray<{ signal: "BUY" | "SELL" | "NEUTRAL"; weight: number }>
): { agreement: number; direction: "BUY" | "SELL" | "NEUTRAL" } =>
  pipe(
    Match.value(indicators.length),
    Match.when(0, () => ({ agreement: 0, direction: "NEUTRAL" as const })),
    Match.orElse(() => {
      const { buyWeight, sellWeight, totalWeight } = indicators.reduce(
        (acc, { signal, weight }) => {
          const { buy, sell } = signalWeight(signal);
          return {
            buyWeight: acc.buyWeight + buy * weight,
            sellWeight: acc.sellWeight + sell * weight,
            totalWeight: acc.totalWeight + weight,
          };
        },
        { buyWeight: 0, sellWeight: 0, totalWeight: 0 }
      );
      const maxWeight = Math.max(buyWeight, sellWeight);
      return {
        agreement: totalWeight > 0 ? maxWeight / totalWeight : 0,
        direction: weightsToDirection(buyWeight, sellWeight),
      };
    })
  );

// Combine confidences using Match
export const combineConfidence = (
  confidences: ReadonlyArray<number>,
  weights?: ReadonlyArray<number>
): number =>
  pipe(
    Match.value({
      len: confidences.length,
      hasWeights: weights && weights.length === confidences.length,
    }),
    Match.when({ len: 0 }, () => 0),
    Match.when({ hasWeights: true }, () => {
      const totalWeight = weights!.reduce((s, w) => s + w, 0);
      return Math.round(confidences.reduce((s, c, i) => s + c * weights![i], 0) / totalWeight);
    }),
    Match.orElse(() => Math.round(confidences.reduce((s, c) => s + c, 0) / confidences.length))
  );
