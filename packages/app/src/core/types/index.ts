/**
 * Minimal type definitions for the app package
 * These types replace the deleted shared types to keep the app functional
 */

import type { CryptoPrice } from "@0xsignal/shared";

export type SignalType = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";

export interface EntrySignal {
  readonly direction: "LONG" | "SHORT" | "NEUTRAL";
  readonly strength: "VERY_WEAK" | "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG" | "EXTREME";
  readonly confidence: number;
  readonly isOptimalEntry: boolean;
  readonly riskRewardRatio: number;
  readonly entryPrice: number;
  readonly targetPrice: number;
  readonly stopLoss: number;
  readonly recommendation: string;
  readonly indicatorSummary: {
    rsi: { value: number; signal: string };
    macd: { trend: string };
    adx: { value: number };
    atr: { value: number; volatility: string };
  };
}

export interface AssetAnalysis {
  readonly symbol: string;
  readonly overallSignal: SignalType;
  readonly confidence: number;
  readonly riskScore: number;
  readonly price: CryptoPrice | null;
  readonly entrySignal: EntrySignal | null;
}

// Simplified MarketOverview for basic functionality
export interface MarketOverview {
  readonly topGainers: CryptoPrice[];
  readonly topLosers: CryptoPrice[];
  readonly mostTraded: CryptoPrice[];
}

// Minimal AssetContext for navigation
export interface AssetContext {
  readonly symbol: string;
  readonly relatedAssets: string[];
}
