/** AI Routes - HTTP endpoints for AI analysis and recommendations */

import { Effect } from "effect";
import { AIServiceTag } from "../../../services/ai";
import type { ChartContext, TradeContext, ModelSelection } from "../../../services/ai-types";
import { AIError } from "../../../services/ai-types";

// POST /api/ai/analyze - Chart analysis
export const analyzeChartRoute = (body: unknown) =>
  Effect.gen(function* () {
    const aiService = yield* AIServiceTag;

    // Validate request body
    if (!body || typeof body !== "object") {
      return yield* Effect.fail({
        status: 400,
        message: "Invalid request body",
      });
    }

    const { symbol, timeframe, priceData, currentPrice, model } = body as Record<string, unknown>;

    if (!symbol || !timeframe || !Array.isArray(priceData) || typeof currentPrice !== "number") {
      return yield* Effect.fail({
        status: 400,
        message: "Missing required fields: symbol, timeframe, priceData, currentPrice",
      });
    }

    const context: ChartContext = {
      symbol: String(symbol),
      timeframe: String(timeframe),
      priceData: priceData.map((p: any) => ({
        timestamp: Number(p.timestamp),
        open: Number(p.open),
        high: Number(p.high),
        low: Number(p.low),
        close: Number(p.close),
        volume: Number(p.volume),
      })),
      currentPrice,
    };

    // Parse optional model selection
    let modelSelection: ModelSelection | undefined;
    if (model && typeof model === "object") {
      const modelObj = model as Record<string, unknown>;
      if (
        modelObj.provider &&
        modelObj.modelId &&
        typeof modelObj.provider === "string" &&
        typeof modelObj.modelId === "string"
      ) {
        modelSelection = {
          provider: modelObj.provider as ModelSelection["provider"],
          modelId: modelObj.modelId,
        };
      }
    }

    const analysis = yield* aiService.analyzeChart(context, modelSelection);
    return analysis;
  }).pipe(
    Effect.catchAll((error) => {
      if (error instanceof AIError) {
        return Effect.fail({
          status: error.code === "CONFIG_ERROR" ? 503 : 500,
          message: error.message,
        });
      }
      return Effect.fail({
        status: 500,
        message: String(error),
      });
    })
  );

// POST /api/ai/recommend - Trade recommendation
export const recommendTradeRoute = (body: unknown) =>
  Effect.gen(function* () {
    const aiService = yield* AIServiceTag;

    // Validate request body
    if (!body || typeof body !== "object") {
      return yield* Effect.fail({
        status: 400,
        message: "Invalid request body",
      });
    }

    const { query, symbol, position, accountValue, riskTolerance, model } = body as Record<
      string,
      unknown
    >;

    if (!query || !symbol || typeof accountValue !== "number") {
      return yield* Effect.fail({
        status: 400,
        message: "Missing required fields: query, symbol, accountValue",
      });
    }

    const context: TradeContext = {
      symbol: String(symbol),
      accountValue,
      riskTolerance: (riskTolerance as TradeContext["riskTolerance"]) || "moderate",
      position: position
        ? {
            side: (position as any).side,
            size: Number((position as any).size),
            entryPrice: Number((position as any).entryPrice),
          }
        : undefined,
    };

    // Parse optional model selection
    let modelSelection: ModelSelection | undefined;
    if (model && typeof model === "object") {
      const modelObj = model as Record<string, unknown>;
      if (
        modelObj.provider &&
        modelObj.modelId &&
        typeof modelObj.provider === "string" &&
        typeof modelObj.modelId === "string"
      ) {
        modelSelection = {
          provider: modelObj.provider as ModelSelection["provider"],
          modelId: modelObj.modelId,
        };
      }
    }

    const recommendation = yield* aiService.getRecommendation(
      String(query),
      context,
      modelSelection
    );
    return recommendation;
  }).pipe(
    Effect.catchAll((error) => {
      if (error instanceof AIError) {
        return Effect.fail({
          status: error.code === "CONFIG_ERROR" ? 503 : 500,
          message: error.message,
        });
      }
      return Effect.fail({
        status: 500,
        message: String(error),
      });
    })
  );

// POST /api/ai/cache/clear - Clear AI cache
export const clearAICacheRoute = (body: unknown) =>
  Effect.gen(function* () {
    const aiService = yield* AIServiceTag;

    if (!body || typeof body !== "object") {
      return yield* Effect.fail({
        status: 400,
        message: "Invalid request body",
      });
    }

    const { symbol, timeframe } = body as Record<string, unknown>;

    if (!symbol || !timeframe) {
      return yield* Effect.fail({
        status: 400,
        message: "Missing required fields: symbol, timeframe",
      });
    }

    yield* aiService.clearCache(String(symbol), String(timeframe));

    return {
      success: true,
      message: `Cache cleared for ${symbol}:${timeframe}`,
    };
  });
