/** Asset Analysis - Single asset analysis with concurrent strategy and entry detection */

import { Effect, Match, Option, Array as Arr, pipe } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { AssetAnalysis, Signal, StrategySignal } from "../domain/types";
import { executeStrategies } from "../domain/strategies/executor";
import { findEntry } from "./find-entries";
import { calculateNoiseScore } from "../domain/formulas/statistical/noise";

// Signal to action recommendation
const signalToAction = Match.type<Signal>().pipe(
  Match.when("STRONG_BUY", () => "ACTION: Strong buy opportunity. Consider entering position."),
  Match.when("BUY", () => "ACTION: Buy signal. Consider smaller position or DCA."),
  Match.when("HOLD", () => "ACTION: Hold current positions. Wait for clearer signals."),
  Match.when("SELL", () => "ACTION: Consider taking profits or reducing exposure."),
  Match.when("STRONG_SELL", () => "ACTION: Exit positions. Protect capital."),
  Match.exhaustive
);

// Default crash signal
const defaultCrashSignal = {
  isCrashing: false,
  severity: "LOW" as const,
  confidence: 0,
  indicators: {
    rapidDrop: false,
    volumeSpike: false,
    oversoldExtreme: false,
    highVolatility: false,
  },
  recommendation: "",
};

// Find metric value from signal
const findMetricInSignal = (
  signal: StrategySignal,
  keys: readonly string[]
): Option.Option<number> => {
  // Direct key match
  const directMatch = pipe(
    keys,
    Arr.findFirst((key) => signal.metrics[key] !== undefined),
    Option.map((key) => signal.metrics[key])
  );

  if (Option.isSome(directMatch)) return directMatch;

  // Prefixed key match
  return pipe(
    keys,
    Arr.findFirst((key) => Object.keys(signal.metrics).some((k) => k.endsWith(`_${key}`))),
    Option.flatMap((key) => {
      const prefixed = Object.keys(signal.metrics).find((k) => k.endsWith(`_${key}`));
      return Option.fromNullable(prefixed ? signal.metrics[prefixed] : undefined);
    })
  );
};

// Extract metric from strategy signals
const extractMetric = (
  result: AssetAnalysis["strategyResult"],
  ...keys: string[]
): number | undefined => {
  // Search in signals array
  const fromSignals = pipe(
    result.signals as readonly StrategySignal[],
    Arr.findFirst((signal) => Option.isSome(findMetricInSignal(signal, keys))),
    Option.flatMap((signal) => findMetricInSignal(signal, keys))
  );

  if (Option.isSome(fromSignals)) return fromSignals.value;

  // Search in primary signal
  return pipe(findMetricInSignal(result.primarySignal, keys), Option.getOrUndefined);
};

// Upgrade signal based on entry strength
const upgradeSignal = Match.type<{ signal: Signal; isOptimal: boolean; strength: string }>().pipe(
  Match.when(
    ({ signal, isOptimal, strength }) =>
      isOptimal && (strength === "VERY_STRONG" || strength === "STRONG") && signal === "BUY",
    () => "STRONG_BUY" as Signal
  ),
  Match.orElse(({ signal }) => signal)
);

// Combine strategy and entry results
const combineResults = (
  strategyResult: AssetAnalysis["strategyResult"],
  entrySignal: AssetAnalysis["entrySignal"]
) => {
  const signal = upgradeSignal({
    signal: strategyResult.primarySignal.signal,
    isOptimal: entrySignal.isOptimalEntry,
    strength: entrySignal.strength,
  });

  const confidence =
    entrySignal.isOptimalEntry &&
    (entrySignal.strength === "VERY_STRONG" || entrySignal.strength === "STRONG")
      ? Math.max(strategyResult.overallConfidence, entrySignal.confidence)
      : strategyResult.overallConfidence;

  const recommendation = pipe(
    [
      `Market Regime: ${strategyResult.regime}`,
      entrySignal.isOptimalEntry ? entrySignal.recommendation : null,
      strategyResult.primarySignal.reasoning,
      signalToAction(signal),
    ],
    Arr.filter((x): x is string => x !== null),
    Arr.join(". ")
  );

  return { overallSignal: signal, confidence, riskScore: strategyResult.riskScore, recommendation };
};

// Analyze single asset
export const analyzeAsset = (price: CryptoPrice): Effect.Effect<AssetAnalysis, never> =>
  Effect.gen(function* () {
    const { strategyResult, entrySignal } = yield* Effect.all(
      {
        strategyResult: executeStrategies(price),
        entrySignal: findEntry(price),
      },
      { concurrency: 2 }
    );

    const { overallSignal, confidence, riskScore, recommendation } = combineResults(
      strategyResult,
      entrySignal
    );

    const adx = extractMetric(strategyResult, "adxValue", "adx") ?? 25;
    const normalizedATR = extractMetric(strategyResult, "normalizedATR", "atr") ?? 3;
    const agreement = extractMetric(strategyResult, "indicatorAgreement");
    const noise = calculateNoiseScore(
      adx,
      normalizedATR,
      agreement !== undefined ? agreement / 100 : undefined
    );

    return {
      symbol: price.symbol,
      timestamp: new Date(),
      price,
      strategyResult,
      crashSignal: defaultCrashSignal,
      entrySignal,
      overallSignal,
      confidence,
      riskScore,
      noise,
      recommendation,
    };
  });
