/**
 * Strategy Executor
 * Orchestrates strategy execution with type-safe pattern matching
 */

import { Effect, Match } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategyResult, StrategySignal, MarketRegime } from "./types";
import { detectRegime } from "./regime";
import { executeMomentumStrategy } from "./momentum";
import { meanReversionStrategy } from "./mean-reversion-strategy";
import { breakoutStrategy } from "./breakout-strategy";
import { volatilityStrategy } from "./volatility-strategy";
import { calculateRiskScore, signalToScore, scoreToSignal } from "../analysis/scoring";

// Type-safe strategy selector using pattern matching
const selectStrategies = Match.type<MarketRegime>().pipe(
  Match.when("BULL_MARKET", () => [executeMomentumStrategy] as const),
  Match.when("BEAR_MARKET", () => [executeMomentumStrategy] as const),
  Match.when("TRENDING", () => [executeMomentumStrategy] as const),
  Match.when("MEAN_REVERSION", () => [meanReversionStrategy] as const),
  Match.when("SIDEWAYS", () => [meanReversionStrategy] as const),
  Match.when("LOW_VOLATILITY", () => [breakoutStrategy, meanReversionStrategy] as const),
  Match.when("HIGH_VOLATILITY", () => [volatilityStrategy] as const),
  Match.exhaustive
);

// Execute all strategies for a price
export const executeStrategies = (price: CryptoPrice): Effect.Effect<StrategyResult, never> =>
  Effect.gen(function* () {
    const regime = yield* detectRegime(price);
    const strategies = selectStrategies(regime);

    // Execute strategies concurrently
    const signals = yield* Effect.all(
      strategies.map((strategy) => strategy(price)),
      { concurrency: "unbounded" }
    );

    return combineSignals(regime, signals);
  });

// Combine multiple signals into a single result
const combineSignals = (
  regime: MarketRegime,
  signals: ReadonlyArray<StrategySignal>
): StrategyResult => {
  if (signals.length === 0) {
    return createEmptyResult(regime);
  }

  const volatility = signals[0].metrics.normalizedATR ?? 3;
  const indicatorAgreement = signals[0].metrics.indicatorAgreement
    ? signals[0].metrics.indicatorAgreement / 100
    : undefined;

  if (signals.length === 1) {
    return {
      regime,
      signals,
      primarySignal: signals[0],
      overallConfidence: signals[0].confidence,
      riskScore: calculateRiskScore(regime, signals[0].confidence, volatility, indicatorAgreement),
    };
  }

  const primarySignal = combineMultipleSignals(signals);

  return {
    regime,
    signals,
    primarySignal,
    overallConfidence: primarySignal.confidence,
    riskScore: calculateRiskScore(regime, primarySignal.confidence, volatility, indicatorAgreement),
  };
};

// Create empty result when no strategies executed
const createEmptyResult = (regime: MarketRegime): StrategyResult => ({
  regime,
  signals: [],
  primarySignal: {
    strategy: "NONE",
    signal: "HOLD",
    confidence: 0,
    reasoning: "No strategies executed",
    metrics: {},
  },
  overallConfidence: 0,
  riskScore: 50,
});

// Combine multiple strategy signals using weighted average
const combineMultipleSignals = (signals: ReadonlyArray<StrategySignal>): StrategySignal => {
  const totalWeight = signals.reduce((sum, s) => sum + s.confidence, 0);
  const weightedScore = signals.reduce((sum, s) => sum + signalToScore(s.signal) * s.confidence, 0);

  const averageScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  const combinedSignal = scoreToSignal(averageScore);

  const averageConfidence = Math.round(
    signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
  );

  const reasoning = signals.map((s) => `${s.strategy}: ${s.reasoning}`).join("; ");

  // Merge all metrics with strategy prefix
  const metrics = signals.reduce<Record<string, number>>(
    (acc, s) => ({
      ...acc,
      ...Object.fromEntries(Object.entries(s.metrics).map(([k, v]) => [`${s.strategy}_${k}`, v])),
    }),
    {}
  );

  return {
    strategy: "COMBINED",
    signal: combinedSignal,
    confidence: averageConfidence,
    reasoning,
    metrics,
  };
};
