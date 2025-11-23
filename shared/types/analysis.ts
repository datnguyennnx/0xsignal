import type { CryptoBubbleAnalysis, CryptoPrice } from "./crypto";

export interface QuantitativeAnalysis {
  readonly symbol: string;
  readonly timestamp: Date;
  readonly bollingerSqueeze: any;
  readonly rsiDivergence: any;
  readonly percentB: number;
  readonly bollingerWidth: number;
  readonly distanceFromMA: number;
  readonly volumeROC: number;
  readonly volumeToMarketCapRatio: number;
  readonly dailyRange: number;
  readonly athDistance: number;
  readonly compositeScores: {
    momentum: {
      rsi: number;
      volumeROC: number;
      priceChange24h: number;
      score: number;
      signal: string;
      insight: string;
    };
    volatility: {
      bollingerWidth: number;
      dailyRange: number;
      athDistance: number;
      score: number;
      regime: string;
      insight: string;
    };
    meanReversion: {
      percentB: number;
      distanceFromMA: number;
      score: number;
      signal: string;
      insight: string;
    };
    overallQuality: number;
  };
  readonly overallSignal: string;
  readonly confidence: number;
  readonly riskScore: number;
}

export interface EnhancedAnalysis {
  readonly symbol: string;
  readonly price: CryptoPrice;
  readonly bubbleAnalysis: CryptoBubbleAnalysis;
  readonly quantAnalysis: QuantitativeAnalysis;
  readonly strategyAnalysis?: any;
  readonly combinedRiskScore: number;
  readonly recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  readonly timestamp: Date;
}

export interface MarketOverview {
  readonly totalAnalyzed: number;
  readonly bubblesDetected: number;
  readonly highRiskAssets: string[];
  readonly averageRiskScore: number;
  readonly timestamp: Date;
}
