import type { CryptoPrice } from "@0xsignal/shared";

export type Signal = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";

export type MarketRegime =
  | "BULL_MARKET"
  | "BEAR_MARKET"
  | "TRENDING"
  | "SIDEWAYS"
  | "MEAN_REVERSION"
  | "LOW_VOLATILITY"
  | "HIGH_VOLATILITY";

export interface IndicatorResult {
  readonly value: number;
  readonly signal: Signal;
  readonly confidence: number;
}

export interface StrategySignal {
  readonly strategy: string;
  readonly signal: Signal;
  readonly confidence: number;
  readonly reasoning: string;
  readonly metrics: Record<string, number>;
}

export interface StrategyResult {
  readonly regime: MarketRegime;
  readonly signals: ReadonlyArray<StrategySignal>;
  readonly primarySignal: StrategySignal;
  readonly overallConfidence: number;
  readonly riskScore: number;
}

export interface CrashIndicators {
  readonly rapidDrop: boolean;
  readonly volumeSpike: boolean;
  readonly oversoldExtreme: boolean;
  readonly highVolatility: boolean;
}

export interface CrashSignal {
  readonly isCrashing: boolean;
  readonly severity: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  readonly confidence: number;
  readonly indicators: CrashIndicators;
  readonly recommendation: string;
}

export interface EntryIndicators {
  readonly trendReversal: boolean;
  readonly volumeIncrease: boolean;
  readonly momentumBuilding: boolean;
  readonly bullishDivergence: boolean;
}

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

export interface MarketOverview {
  readonly totalAnalyzed: number;
  readonly highRiskAssets: string[];
  readonly averageRiskScore: number;
  readonly timestamp: Date;
}
