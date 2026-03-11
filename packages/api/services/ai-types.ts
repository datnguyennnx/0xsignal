/** AI Service Types - Domain types for AI analysis */

import { Data } from "effect";

// Domain Types
export interface PricePoint {
  readonly timestamp: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export interface ChartContext {
  readonly symbol: string;
  readonly timeframe: string;
  readonly priceData: readonly PricePoint[];
  readonly currentPrice: number;
}

export interface TradeContext {
  readonly symbol: string;
  readonly position?: {
    readonly side: "long" | "short";
    readonly size: number;
    readonly entryPrice: number;
  };
  readonly accountValue: number;
  readonly riskTolerance: "conservative" | "moderate" | "aggressive";
}

export interface KeyLevels {
  readonly support: readonly number[];
  readonly resistance: readonly number[];
}

export interface AIAnalysis {
  readonly marketStructure: string;
  readonly trend: "bullish" | "bearish" | "neutral";
  readonly keyLevels: KeyLevels;
  readonly observations: readonly string[];
  readonly sentiment: "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish";
}

export interface Target {
  readonly price: number;
  readonly probability: number;
}

export interface EntryZone {
  readonly min: number;
  readonly max: number;
}

export interface ICTAnalysis {
  readonly fairValueGap?: { readonly top: number; readonly bottom: number };
  readonly orderBlock?: { readonly price: number; readonly type: "bullish" | "bearish" };
  readonly liquiditySweep: boolean;
  readonly marketStructureShift: boolean;
}

export interface TradeRecommendation {
  readonly recommendation: "buy" | "sell" | "hold" | "close";
  readonly confidence: number;
  readonly entryZone: EntryZone;
  readonly stopLoss: number;
  readonly targets: readonly Target[];
  readonly reasoning: string;
  readonly ictAnalysis: ICTAnalysis;
}

// Streaming Types
export interface AIChunk {
  readonly type: "chunk" | "complete" | "error";
  readonly content?: string;
  readonly analysis?: AIAnalysis;
  readonly error?: string;
}

// Errors
export class AIError extends Data.TaggedError("AIError")<{
  readonly message: string;
  readonly code:
    | "CONFIG_ERROR"
    | "EMPTY_RESPONSE"
    | "PARSE_ERROR"
    | "VALIDATION_ERROR"
    | "API_ERROR";
  readonly cause?: unknown;
}> {}

export class AIStreamingError extends Data.TaggedError("AIStreamingError")<{
  readonly message: string;
  readonly code: "STREAM_ERROR" | "CONNECTION_ERROR" | "TIMEOUT_ERROR";
  readonly cause?: unknown;
}> {}

// Cache Types
export interface CachedAnalysis {
  readonly data: AIAnalysis;
  readonly timestamp: number;
}

// Model Selection Type
export interface ModelSelection {
  readonly provider: "openai" | "anthropic" | "google";
  readonly modelId: string;
}
