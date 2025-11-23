// ============================================================================
// STRATEGY-BASED ANALYZER
// ============================================================================
// Simplified analyzer that uses strategy system
// Replaces complex analyzer.ts with clean strategy composition
// ============================================================================

import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { executeStrategies, type StrategyResult } from "../strategies";
import {
  detectMarketCrash,
  type CrashSignal,
} from "../../application/use-cases/market-crash-detection";
import {
  detectBullMarketEntry,
  type BullEntrySignal,
} from "../../application/use-cases/bull-market-entry";

/**
 * Complete analysis result combining strategies and use cases
 */
export interface StrategyBasedAnalysis {
  readonly symbol: string;
  readonly timestamp: Date;

  // Core strategy analysis
  readonly strategyResult: StrategyResult;

  // Use case signals
  readonly crashSignal: CrashSignal;
  readonly bullEntrySignal: BullEntrySignal;

  // Final recommendation
  readonly overallSignal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  readonly confidence: number;
  readonly riskScore: number;
  readonly actionableInsight: string;
}

/**
 * Execute complete strategy-based analysis
 * This is the main entry point for analysis
 */
export const analyzeWithStrategies = (
  price: CryptoPrice
): Effect.Effect<StrategyBasedAnalysis, never> =>
  Effect.gen(function* () {
    // Run all analyses in parallel
    const [strategyResult, crashSignal, bullEntrySignal] = yield* Effect.all(
      [executeStrategies(price), detectMarketCrash(price), detectBullMarketEntry(price)],
      { concurrency: "unbounded" }
    );

    // Combine results into final recommendation
    const finalResult = combineResults(price, strategyResult, crashSignal, bullEntrySignal);

    return finalResult;
  });

/**
 * Pure function to combine all results into final recommendation
 */
const combineResults = (
  price: CryptoPrice,
  strategyResult: StrategyResult,
  crashSignal: CrashSignal,
  bullEntrySignal: BullEntrySignal
): StrategyBasedAnalysis => {
  // Start with strategy signal
  let overallSignal = strategyResult.primarySignal.signal;
  let confidence = strategyResult.overallConfidence;
  let riskScore = strategyResult.riskScore;

  // Override with crash detection (highest priority)
  if (crashSignal.isCrashing) {
    if (crashSignal.severity === "EXTREME" || crashSignal.severity === "HIGH") {
      overallSignal = "STRONG_SELL";
      confidence = Math.max(confidence, crashSignal.confidence);
      riskScore = Math.max(riskScore, 90);
    } else if (crashSignal.severity === "MEDIUM") {
      overallSignal = overallSignal === "STRONG_BUY" ? "HOLD" : "SELL";
      riskScore = Math.max(riskScore, 70);
    }
  }

  // Enhance with bull entry signal
  if (bullEntrySignal.isOptimalEntry && !crashSignal.isCrashing) {
    if (bullEntrySignal.strength === "VERY_STRONG" || bullEntrySignal.strength === "STRONG") {
      if (overallSignal === "BUY") {
        overallSignal = "STRONG_BUY";
      }
      confidence = Math.max(confidence, bullEntrySignal.confidence);
    }
  }

  // Generate actionable insight
  const actionableInsight = generateActionableInsight(
    overallSignal,
    strategyResult,
    crashSignal,
    bullEntrySignal
  );

  return {
    symbol: price.symbol,
    timestamp: new Date(),
    strategyResult,
    crashSignal,
    bullEntrySignal,
    overallSignal,
    confidence,
    riskScore,
    actionableInsight,
  };
};

/**
 * Pure function to generate actionable insight
 */
const generateActionableInsight = (
  signal: StrategyBasedAnalysis["overallSignal"],
  strategyResult: StrategyResult,
  crashSignal: CrashSignal,
  bullEntrySignal: BullEntrySignal
): string => {
  const parts: string[] = [];

  // Market regime context
  parts.push(`Market Regime: ${strategyResult.regime}`);

  // Crash warning (highest priority)
  if (crashSignal.isCrashing) {
    parts.push(`⚠️ ${crashSignal.recommendation}`);
    return parts.join(". ");
  }

  // Bull entry opportunity
  if (bullEntrySignal.isOptimalEntry) {
    parts.push(`✓ ${bullEntrySignal.recommendation}`);
  }

  // Strategy reasoning
  parts.push(strategyResult.primarySignal.reasoning);

  // Final action
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

/**
 * Batch analysis for multiple cryptocurrencies
 */
export const analyzeBatchWithStrategies = (
  prices: ReadonlyArray<CryptoPrice>
): Effect.Effect<ReadonlyArray<StrategyBasedAnalysis>, never> =>
  Effect.forEach(prices, (price) => analyzeWithStrategies(price), {
    concurrency: "unbounded",
  });
