import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { AssetAnalysis, Signal } from "../domain/types";
import { executeStrategies } from "../domain/strategies/executor";
import { findEntry } from "./find-entries";

export const analyzeAsset = (price: CryptoPrice): Effect.Effect<AssetAnalysis, never> =>
  Effect.gen(function* () {
    const [strategyResult, entrySignal] = yield* Effect.all(
      [executeStrategies(price), findEntry(price)],
      { concurrency: "unbounded" }
    );

    const { overallSignal, confidence, riskScore, recommendation } = combineResults(
      price,
      strategyResult,
      entrySignal
    );

    return {
      symbol: price.symbol,
      timestamp: new Date(),
      price,
      strategyResult,
      crashSignal: {
        isCrashing: false,
        severity: "LOW",
        confidence: 0,
        indicators: {
          rapidDrop: false,
          volumeSpike: false,
          oversoldExtreme: false,
          highVolatility: false,
        },
        recommendation: "",
      },
      entrySignal,
      overallSignal,
      confidence,
      riskScore,
      recommendation,
    };
  });

const combineResults = (
  price: CryptoPrice,
  strategyResult: AssetAnalysis["strategyResult"],
  entrySignal: AssetAnalysis["entrySignal"]
) => {
  let overallSignal = strategyResult.primarySignal.signal;
  let confidence = strategyResult.overallConfidence;
  let riskScore = strategyResult.riskScore;

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

  switch (signal) {
    case "STRONG_BUY":
      parts.push("ACTION: Strong buy opportunity. Consider entering position.");
      break;
    case "BUY":
      parts.push("ACTION: Buy signal. Consider smaller position or DCA.");
      break;
    case "HOLD":
      parts.push("ACTION: Hold current positions. Wait for clearer signals.");
      break;
    case "SELL":
      parts.push("ACTION: Consider taking profits or reducing exposure.");
      break;
    case "STRONG_SELL":
      parts.push("ACTION: Exit positions. Protect capital.");
      break;
  }

  return parts.join(". ");
};
