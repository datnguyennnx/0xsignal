// ============================================================================
// STRATEGY TYPES - FUNCTIONAL APPROACH
// ============================================================================
// Core types for defining trading strategies
// Strategies determine which formulas to apply based on market conditions
// ============================================================================

import type { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";

/**
 * Market regime classification
 */
export type MarketRegime =
  | "BULL_MARKET" // Strong uptrend, high momentum
  | "BEAR_MARKET" // Strong downtrend, high momentum
  | "SIDEWAYS" // Low momentum, range-bound
  | "HIGH_VOLATILITY" // Extreme price swings
  | "LOW_VOLATILITY" // Compressed range, potential breakout
  | "MEAN_REVERSION" // Price extended from average
  | "TRENDING"; // Clear directional movement

/**
 * Strategy signal output
 */
export interface StrategySignal {
  readonly strategy: string;
  readonly signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  readonly confidence: number; // 0-100
  readonly reasoning: string;
  readonly metrics: Record<string, number>;
}

/**
 * Strategy execution result
 */
export interface StrategyResult {
  readonly regime: MarketRegime;
  readonly signals: ReadonlyArray<StrategySignal>;
  readonly primarySignal: StrategySignal;
  readonly overallConfidence: number;
  readonly riskScore: number;
}

/**
 * Strategy function type
 * Takes price data and returns a strategy signal
 */
export type Strategy = (price: CryptoPrice) => Effect.Effect<StrategySignal, never>;

/**
 * Regime detector function type
 * Analyzes price data to determine current market regime
 */
export type RegimeDetector = (price: CryptoPrice) => Effect.Effect<MarketRegime, never>;
