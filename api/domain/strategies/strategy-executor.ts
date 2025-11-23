// ============================================================================
// STRATEGY EXECUTOR
// ============================================================================
// Selects and executes appropriate strategies based on market regime
// Combines multiple strategy signals into final recommendation
// ============================================================================

import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategyResult, StrategySignal, MarketRegime } from "./types";
import { detectMarketRegime } from "./regime-detection";
import { momentumStrategy } from "./momentum-strategy";
import { meanReversionStrategy } from "./mean-reversion-strategy";
import { breakoutStrategy } from "./breakout-strategy";
import { volatilityStrategy } from "./volatility-strategy";

/**
 * Execute appropriate strategies based on detected market regime
 */
export const executeStrategies = (price: CryptoPrice): Effect.Effect<StrategyResult, never> =>
  Effect.gen(function* () {
    // Detect current market regime
    const regime = yield* detectMarketRegime(price);

    // Select strategies based on regime
    const strategies = selectStrategies(regime);

    // Execute all selected strategies in parallel
    const signals = yield* Effect.all(
      strategies.map((strategy) => strategy(price)),
      { concurrency: "unbounded" }
    );

    // Combine signals into final result
    const result = combineSignals(regime, signals);

    return result;
  });

/**
 * Pure function to select strategies based on market regime
 */
const selectStrategies = (regime: MarketRegime): ReadonlyArray<typeof momentumStrategy> => {
  switch (regime) {
    case "BULL_MARKET":
    case "BEAR_MARKET":
    case "TRENDING":
      // Trending markets: use momentum strategy
      return [momentumStrategy];

    case "MEAN_REVERSION":
    case "SIDEWAYS":
      // Range-bound markets: use mean reversion strategy
      return [meanReversionStrategy];

    case "LOW_VOLATILITY":
      // Compression: use breakout strategy
      return [breakoutStrategy, meanReversionStrategy];

    case "HIGH_VOLATILITY":
      // Extreme volatility: use volatility strategy
      return [volatilityStrategy];

    default:
      // Default: use momentum and mean reversion
      return [momentumStrategy, meanReversionStrategy];
  }
};

/**
 * Pure function to combine multiple strategy signals
 */
const combineSignals = (
  regime: MarketRegime,
  signals: ReadonlyArray<StrategySignal>
): StrategyResult => {
  if (signals.length === 0) {
    return {
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
    };
  }

  // If single strategy, use it directly
  if (signals.length === 1) {
    return {
      regime,
      signals,
      primarySignal: signals[0],
      overallConfidence: signals[0].confidence,
      riskScore: calculateRiskScore(regime, signals[0]),
    };
  }

  // Multiple strategies: combine with weighted average
  const primarySignal = combineMultipleSignals(signals);

  return {
    regime,
    signals,
    primarySignal,
    overallConfidence: primarySignal.confidence,
    riskScore: calculateRiskScore(regime, primarySignal),
  };
};

/**
 * Pure function to combine multiple strategy signals
 */
const combineMultipleSignals = (signals: ReadonlyArray<StrategySignal>): StrategySignal => {
  // Convert signals to numeric scores
  const signalToScore = (signal: StrategySignal["signal"]): number => {
    switch (signal) {
      case "STRONG_BUY":
        return 100;
      case "BUY":
        return 50;
      case "HOLD":
        return 0;
      case "SELL":
        return -50;
      case "STRONG_SELL":
        return -100;
    }
  };

  // Weighted average based on confidence
  const totalWeight = signals.reduce((sum, s) => sum + s.confidence, 0);
  const weightedScore = signals.reduce((sum, s) => sum + signalToScore(s.signal) * s.confidence, 0);

  const averageScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // Convert back to signal
  const combinedSignal: StrategySignal["signal"] =
    averageScore > 60
      ? "STRONG_BUY"
      : averageScore > 20
        ? "BUY"
        : averageScore < -60
          ? "STRONG_SELL"
          : averageScore < -20
            ? "SELL"
            : "HOLD";

  // Average confidence
  const averageConfidence = Math.round(
    signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
  );

  // Combine reasoning
  const reasoning = signals.map((s) => `${s.strategy}: ${s.reasoning}`).join("; ");

  // Merge metrics
  const metrics = signals.reduce(
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

/**
 * Pure function to calculate risk score based on regime and signal
 */
const calculateRiskScore = (regime: MarketRegime, signal: StrategySignal): number => {
  let baseRisk = 50;

  // Regime-based risk
  switch (regime) {
    case "HIGH_VOLATILITY":
      baseRisk = 80;
      break;
    case "LOW_VOLATILITY":
      baseRisk = 40;
      break;
    case "BULL_MARKET":
      baseRisk = 30;
      break;
    case "BEAR_MARKET":
      baseRisk = 70;
      break;
    case "MEAN_REVERSION":
      baseRisk = 45;
      break;
    case "TRENDING":
      baseRisk = 35;
      break;
    case "SIDEWAYS":
      baseRisk = 50;
      break;
  }

  // Adjust based on signal confidence
  // Lower confidence = higher risk
  const confidenceAdjustment = (100 - signal.confidence) * 0.2;

  return Math.round(Math.min(100, baseRisk + confidenceAdjustment));
};
