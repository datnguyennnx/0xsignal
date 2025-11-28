/**
 * Asset Analysis
 * Single asset analysis with concurrent strategy and entry detection
 */

import { Effect, Match } from "effect";
import type { CryptoPrice, NoiseScore } from "@0xsignal/shared";
import type { AssetAnalysis, Signal } from "../domain/types";
import { executeStrategies } from "../domain/strategies/executor";
import { findEntry } from "./find-entries";
import { calculateNoiseScore } from "../domain/formulas/statistical/noise";

// Analyze single asset with concurrent computations
export const analyzeAsset = (price: CryptoPrice): Effect.Effect<AssetAnalysis, never> =>
  Effect.gen(function* () {
    // Execute strategy and entry detection concurrently
    const { strategyResult, entrySignal } = yield* Effect.all(
      {
        strategyResult: executeStrategies(price),
        entrySignal: findEntry(price),
      },
      { concurrency: 2 }
    );

    const { overallSignal, confidence, riskScore, recommendation } = combineResults(
      price,
      strategyResult,
      entrySignal
    );

    // Extract metrics for noise calculation
    const adx = extractMetric(strategyResult, "adxValue", "adx") ?? 25;
    const normalizedATR = extractMetric(strategyResult, "normalizedATR", "atr") ?? 3;
    const indicatorAgreement = extractMetric(strategyResult, "indicatorAgreement");
    const agreementRatio = indicatorAgreement !== undefined ? indicatorAgreement / 100 : undefined;
    const noise = calculateNoiseScore(adx, normalizedATR, agreementRatio);

    return {
      symbol: price.symbol,
      timestamp: new Date(),
      price,
      strategyResult,
      crashSignal: createDefaultCrashSignal(),
      entrySignal,
      overallSignal,
      confidence,
      riskScore,
      noise,
      recommendation,
    };
  });

// Default crash signal (no crash detected)
const createDefaultCrashSignal = () => ({
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
});

// Extract metric from strategy result
const extractMetric = (
  strategyResult: AssetAnalysis["strategyResult"],
  ...keys: string[]
): number | undefined => {
  // Check all signals
  for (const signal of strategyResult.signals) {
    for (const key of keys) {
      const value = signal.metrics[key];
      if (value !== undefined) return value;
      // Check prefixed keys
      const prefixedKey = Object.keys(signal.metrics).find((k) => k.endsWith(`_${key}`));
      if (prefixedKey) return signal.metrics[prefixedKey];
    }
  }
  // Check primary signal
  for (const key of keys) {
    const value = strategyResult.primarySignal.metrics[key];
    if (value !== undefined) return value;
  }
  return undefined;
};

// Combine strategy and entry results
const combineResults = (
  price: CryptoPrice,
  strategyResult: AssetAnalysis["strategyResult"],
  entrySignal: AssetAnalysis["entrySignal"]
) => {
  let overallSignal = strategyResult.primarySignal.signal;
  let confidence = strategyResult.overallConfidence;
  const riskScore = strategyResult.riskScore;

  // Upgrade signal if optimal entry detected
  if (entrySignal.isOptimalEntry) {
    if (entrySignal.strength === "VERY_STRONG" || entrySignal.strength === "STRONG") {
      if (overallSignal === "BUY") {
        overallSignal = "STRONG_BUY";
      }
      confidence = Math.max(confidence, entrySignal.confidence);
    }
  }

  const recommendation = buildRecommendation(overallSignal, strategyResult, entrySignal);

  return { overallSignal, confidence, riskScore, recommendation };
};

// Build recommendation using pattern matching
const signalToAction = Match.type<Signal>().pipe(
  Match.when("STRONG_BUY", () => "ACTION: Strong buy opportunity. Consider entering position."),
  Match.when("BUY", () => "ACTION: Buy signal. Consider smaller position or DCA."),
  Match.when("HOLD", () => "ACTION: Hold current positions. Wait for clearer signals."),
  Match.when("SELL", () => "ACTION: Consider taking profits or reducing exposure."),
  Match.when("STRONG_SELL", () => "ACTION: Exit positions. Protect capital."),
  Match.exhaustive
);

const buildRecommendation = (
  signal: Signal,
  strategyResult: AssetAnalysis["strategyResult"],
  entrySignal: AssetAnalysis["entrySignal"]
): string => {
  const parts: string[] = [];

  parts.push(`Market Regime: ${strategyResult.regime}`);

  if (entrySignal.isOptimalEntry) {
    parts.push(entrySignal.recommendation);
  }

  parts.push(strategyResult.primarySignal.reasoning);
  parts.push(signalToAction(signal));

  return parts.join(". ");
};
