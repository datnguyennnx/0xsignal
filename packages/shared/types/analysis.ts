import type { CryptoPrice } from "./crypto";

export type Signal = "BUY" | "SELL" | "HOLD" | "STRONG_BUY" | "STRONG_SELL";
export type MarketRegime =
  | "TRENDING"
  | "RANGING"
  | "VOLATILE"
  | "ACCUMULATION"
  | "DISTRIBUTION"
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY"
  | "BULL_MARKET"
  | "BEAR_MARKET"
  | "SIDEWAYS"
  | "MEAN_REVERSION";

export type TradeDirection = "LONG" | "SHORT" | "NEUTRAL";
export type TrendStrength =
  | "WEAK"
  | "MODERATE"
  | "STRONG"
  | "EXTREME"
  | "VERY_STRONG"
  | "VERY_WEAK";

export interface NoiseScore {
  readonly score: number;
  readonly value?: number; // Legacy support
  readonly level: "LOW" | "MEDIUM" | "HIGH" | "MODERATE" | "EXTREME";
  readonly factors?: readonly string[];
}

export interface MarketCondition {
  readonly regime: MarketRegime;
  readonly dominance_index?: number;
  readonly volatility_score?: number;
}

export interface TechnicalSignal {
  readonly type: Signal;
  readonly confidence: number;
  readonly timeframe: string;
  readonly indicators?: {
    readonly rsi: number;
    readonly macd: {
      readonly histogram: number;
      readonly signal: number;
      readonly line: number;
    };
    readonly adx: number;
  };
}

export interface IndicatorResult {
  readonly value: number;
  readonly signal: Signal | "NEUTRAL" | "OVERSOLD" | "OVERBOUGHT";
  readonly period?: number;
}

export interface IndicatorSummary {
  readonly rsi: IndicatorResult;
  readonly macd: { trend: TradeDirection | "BULLISH" | "BEARISH" | "NEUTRAL"; histogram: number };
  readonly adx: { value: number; strength: TrendStrength };
  readonly atr: {
    value: number;
    volatility: "VERY_LOW" | "LOW" | "NORMAL" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  };
}

export type EntryIndicators = {
  readonly trendReversal: boolean;
  readonly volumeIncrease: boolean;
  readonly momentumBuilding: boolean;
  readonly divergence: boolean;
};

export type EntrySignal = {
  readonly direction: TradeDirection;
  readonly isOptimalEntry: boolean;
  readonly strength: TrendStrength;
  readonly confidence: number;
  readonly indicators: EntryIndicators;
  readonly entryPrice: number;
  readonly targetPrice: number;
  readonly stopLoss: number;
  readonly riskRewardRatio: number;
  readonly suggestedLeverage: number;
  readonly maxLeverage: number;
  readonly indicatorSummary: IndicatorSummary;
  readonly dataSource: "REAL_TIME" | "INSUFFICIENT_DATA" | "HISTORICAL_OHLCV";
  readonly recommendation: string;
};

export interface StrategySignal {
  readonly strategy: string;
  readonly signal: Signal;
  readonly confidence: number;
  readonly reasoning: string;
  readonly metrics: Record<string, number>;
}

export interface StrategyResult {
  readonly regime: MarketRegime;
  readonly signals: readonly StrategySignal[];
  readonly primarySignal: StrategySignal;
  readonly overallConfidence: number;
  readonly riskScore: number;
}

export interface AssetAnalysis {
  readonly symbol: string;
  readonly price: CryptoPrice;
  readonly overallSignal: Signal; // Was 'signal' in some contexts, standardized to overallSignal
  readonly confidence: number;
  readonly riskScore: number; // Was score

  // Strategy & Entry
  readonly entrySignal: EntrySignal;
  readonly strategyResult: StrategyResult;

  // Legacy/UI Compatibility
  readonly score?: number;
  readonly regime?: MarketRegime;
  readonly direction?: TradeDirection;
  readonly strength?: TrendStrength;
  readonly condition?: MarketCondition;
  readonly technicals?: TechnicalSignal;

  readonly noise: NoiseScore;

  readonly timestamp: Date;
  readonly recommendation: string;
  readonly sparkline?: number[];
}

export interface MarketOverview {
  readonly globalRegime: MarketRegime;
  readonly averageConfidence: number;
  readonly activeSignals: number;
  readonly topOpportunities: readonly AssetAnalysis[];
  readonly riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  readonly timestamp: Date;
  // Extended properties used by API
  readonly totalAnalyzed?: number;
  readonly highRiskAssets?: number;
  readonly averageRiskScore?: number;
}
