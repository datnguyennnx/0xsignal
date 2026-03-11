/** AI Service Interface - Effect service definition for AI analysis */

import { Effect, Stream, Context } from "effect";
import type {
  ChartContext,
  TradeContext,
  AIAnalysis,
  TradeRecommendation,
  AIChunk,
  AIError,
  AIStreamingError,
  ModelSelection,
} from "./ai-types";

// Service Interface
export interface AIService {
  readonly analyzeChart: (
    context: ChartContext,
    model?: ModelSelection
  ) => Effect.Effect<AIAnalysis, AIError, never>;

  readonly getRecommendation: (
    query: string,
    context: TradeContext,
    model?: ModelSelection
  ) => Effect.Effect<TradeRecommendation, AIError, never>;

  readonly streamAnalysis: (
    context: ChartContext,
    model?: ModelSelection
  ) => Stream.Stream<AIChunk, AIStreamingError, never>;

  readonly clearCache: (symbol: string, timeframe: string) => Effect.Effect<void, never, never>;
}

// Service Tag
export class AIServiceTag extends Context.Tag("AIService")<AIServiceTag, AIService>() {}
