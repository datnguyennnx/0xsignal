import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategyResult, StrategySignal, MarketRegime } from "./types";
import { detectRegime } from "./regime";
import { executeMomentumStrategy } from "./momentum";
import { meanReversionStrategy } from "./mean-reversion-strategy";
import { breakoutStrategy } from "./breakout-strategy";
import { volatilityStrategy } from "./volatility-strategy";
import { calculateRiskScore, signalToScore, scoreToSignal } from "../analysis/scoring";

export const executeStrategies = (price: CryptoPrice): Effect.Effect<StrategyResult, never> =>
  Effect.gen(function* () {
    const regime = yield* detectRegime(price);
    const strategies = selectStrategies(regime);

    const signals = yield* Effect.all(
      strategies.map((strategy) => strategy(price)),
      { concurrency: "unbounded" }
    );

    const result = combineSignals(regime, signals);
    return result;
  });

const selectStrategies = (regime: MarketRegime): ReadonlyArray<typeof executeMomentumStrategy> => {
  switch (regime) {
    case "BULL_MARKET":
    case "BEAR_MARKET":
    case "TRENDING":
      return [executeMomentumStrategy];

    case "MEAN_REVERSION":
    case "SIDEWAYS":
      return [meanReversionStrategy];

    case "LOW_VOLATILITY":
      return [breakoutStrategy, meanReversionStrategy];

    case "HIGH_VOLATILITY":
      return [volatilityStrategy];

    default:
      return [executeMomentumStrategy, meanReversionStrategy];
  }
};

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

  // Extract volatility and indicator agreement from metrics
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

const combineMultipleSignals = (signals: ReadonlyArray<StrategySignal>): StrategySignal => {
  const totalWeight = signals.reduce((sum, s) => sum + s.confidence, 0);
  const weightedScore = signals.reduce((sum, s) => sum + signalToScore(s.signal) * s.confidence, 0);

  const averageScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  const combinedSignal = scoreToSignal(averageScore);

  const averageConfidence = Math.round(
    signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
  );

  const reasoning = signals.map((s) => `${s.strategy}: ${s.reasoning}`).join("; ");

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
