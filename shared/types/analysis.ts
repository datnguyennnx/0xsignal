import type { CryptoPrice } from "./crypto";

/**
 * Trading signal types
 */
export type Signal = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";

/**
 * Market regime classification
 */
export type MarketRegime =
  | "BULL_MARKET"
  | "BEAR_MARKET"
  | "TRENDING"
  | "SIDEWAYS"
  | "MEAN_REVERSION"
  | "LOW_VOLATILITY"
  | "HIGH_VOLATILITY";

/**
 * Strategy signal output
 */
export interface StrategySignal {
  readonly strategy: string;
  readonly signal: Signal;
  readonly confidence: number;
  readonly reasoning: string;
  readonly metrics: Record<string, number>;
}

/**
 * Strategy execution result
 */
export interface StrategyResult {
  readonly regime: MarketRegime;
  readonly signals: readonly StrategySignal[];
  readonly primarySignal: StrategySignal;
  readonly overallConfidence: number;
  readonly riskScore: number;
}

/**
 * Crash detection indicators
 */
export interface CrashIndicators {
  readonly rapidDrop: boolean;
  readonly volumeSpike: boolean;
  readonly oversoldExtreme: boolean;
  readonly highVolatility: boolean;
}

/**
 * Crash signal output
 */
export interface CrashSignal {
  readonly isCrashing: boolean;
  readonly severity: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  readonly confidence: number;
  readonly indicators: CrashIndicators;
  readonly recommendation: string;
}

/**
 * Entry detection indicators
 */
export interface EntryIndicators {
  readonly trendReversal: boolean;
  readonly volumeIncrease: boolean;
  readonly momentumBuilding: boolean;
  readonly bullishDivergence: boolean;
}

/**
 * Entry signal output
 */
export interface EntrySignal {
  readonly isOptimalEntry: boolean;
  readonly strength: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";
  readonly confidence: number;
  readonly indicators: EntryIndicators;
  readonly entryPrice: number;
  readonly targetPrice: number;
  readonly stopLoss: number;
  readonly recommendation: string;
}

/**
 * Complete asset analysis result
 */
export interface AssetAnalysis {
  readonly symbol: string;
  readonly timestamp: Date;
  readonly price: CryptoPrice;
  readonly strategyResult: StrategyResult;
  readonly crashSignal: CrashSignal;
  readonly entrySignal: EntrySignal;
  readonly overallSignal: Signal;
  readonly confidence: number;
  readonly riskScore: number;
  readonly recommendation: string;
}

/**
 * Market overview summary
 */
export interface MarketOverview {
  readonly totalAnalyzed: number;
  readonly highRiskAssets: readonly string[];
  readonly averageRiskScore: number;
  readonly timestamp: Date;
}

/**
 * Indicator result base interface
 */
export interface IndicatorResult {
  readonly value: number;
  readonly signal: Signal;
  readonly confidence: number;
}
