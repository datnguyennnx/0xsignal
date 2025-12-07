import type { CryptoPrice } from "./crypto";

export type Signal = "BUY" | "SELL" | "HOLD";
export type MarketRegime = "TRENDING" | "RANGING" | "VOLATILE" | "ACCUMULATION" | "DISTRIBUTION";
export type TradeDirection = "LONG" | "SHORT" | "NEUTRAL";
export type TrendStrength = "WEAK" | "MODERATE" | "STRONG" | "EXTREME";

export interface NoiseScore {
  readonly score: number;
  readonly level: "LOW" | "MEDIUM" | "HIGH";
  readonly factors: readonly string[];
}

export interface MarketCondition {
  readonly regime: MarketRegime;
  readonly dominance_index: number;
  readonly volatility_score: number;
}

export interface TechnicalSignal {
  readonly type: Signal;
  readonly confidence: number;
  readonly timeframe: string;
  readonly indicators: {
    readonly rsi: number;
    readonly macd: {
      readonly histogram: number;
      readonly signal: number;
      readonly line: number;
    };
    readonly adx: number;
  };
}

export interface AssetAnalysis {
  readonly symbol: string;
  readonly price: CryptoPrice;
  readonly signal: Signal;
  readonly confidence: number;
  readonly score: number;

  readonly regime: MarketRegime;
  readonly direction: TradeDirection;
  readonly strength: TrendStrength;

  readonly noise: NoiseScore;

  readonly condition?: MarketCondition;
  readonly technicals?: TechnicalSignal;

  readonly timestamp: Date;

  // Computed fields often used in UI
  readonly recommendation: string;
}
