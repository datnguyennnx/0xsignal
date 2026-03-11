/** AI Service Live Implementation - Multi-provider AI with dynamic model selection */

import { Effect, Stream, Layer, Schedule, Option, pipe, Redacted } from "effect";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { AIServiceTag, type AIService } from "./ai";
import {
  type ChartContext,
  type TradeContext,
  type AIAnalysis,
  type TradeRecommendation,
  type AIChunk,
  type CachedAnalysis,
  type ModelSelection,
  AIError,
  AIStreamingError,
} from "./ai-types";
import { AppConfigTag, type AIProvider, type TaskType } from "../infrastructure/config/app.config";
import {
  ModelsRegistryTag,
  ModelsRegistryLive,
  type ModelInfo,
  type ModelCapability,
} from "./models-registry";
import * as Logger from "../infrastructure/logging/logger";

// Cache storage with TTL
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const analysisCache = new Map<string, CachedAnalysis>();

// Helper functions
const getCacheKey = (context: ChartContext): string => `${context.symbol}:${context.timeframe}`;

const getCachedAnalysis = (context: ChartContext): Option.Option<AIAnalysis> =>
  pipe(
    Option.fromNullable(analysisCache.get(getCacheKey(context))),
    Option.filter((cached) => Date.now() - cached.timestamp < CACHE_TTL),
    Option.map((cached) => cached.data)
  );

const setCachedAnalysis = (context: ChartContext, data: AIAnalysis): void => {
  analysisCache.set(getCacheKey(context), { data, timestamp: Date.now() });
};

const clearCacheEntry = (symbol: string, timeframe: string): void => {
  analysisCache.delete(`${symbol}:${timeframe}`);
};

// Client creators
const createOpenAIClient = (apiKey: string): OpenAI => new OpenAI({ apiKey });

const createAnthropicClient = (apiKey: string): Anthropic => new Anthropic({ apiKey });

const createGoogleClient = (apiKey: string): GoogleGenerativeAI => new GoogleGenerativeAI(apiKey);

// Cost tracking
interface CostTracker {
  totalCost: number;
  requestCount: number;
  tokensIn: number;
  tokensOut: number;
}

const costTracker: CostTracker = {
  totalCost: 0,
  requestCount: 0,
  tokensIn: 0,
  tokensOut: 0,
};

const trackCost = (model: ModelInfo, inputTokens: number, outputTokens: number): void => {
  const inputCost = (inputTokens / 1_000_000) * model.cost.input;
  const outputCost = (outputTokens / 1_000_000) * model.cost.output;
  const totalRequestCost = inputCost + outputCost;

  costTracker.totalCost += totalRequestCost;
  costTracker.requestCount += 1;
  costTracker.tokensIn += inputTokens;
  costTracker.tokensOut += outputTokens;
};

// Model selection based on task
const getRequiredCapabilities = (task: TaskType): ModelCapability[] => {
  switch (task) {
    case "chart_analysis":
      return ["reasoning", "structured_output"];
    case "trade_recommendation":
      return ["structured_output"];
    case "streaming":
      return []; // No specific requirements for streaming
    default:
      return ["structured_output"];
  }
};

// Prompt builders
const buildChartAnalysisPrompt = (context: ChartContext): string => {
  const recentCandles = context.priceData.slice(-50);
  const priceSummary = recentCandles.map((c) => ({
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
    v: c.volume,
  }));

  return `You are an expert cryptocurrency technical analyst specializing in ICT (Inner Circle Trader) concepts. Analyze the following chart data for ${context.symbol} on the ${context.timeframe} timeframe.

Current Price: $${context.currentPrice.toFixed(2)}

Recent Price Data (OHLCV - last 50 candles):
${JSON.stringify(priceSummary, null, 2)}

Provide your analysis in the following JSON format:
{
  "marketStructure": "Detailed description of current market structure (BOS, CHoCH, etc.)",
  "trend": "bullish|bearish|neutral",
  "keyLevels": {
    "support": [array of support levels as numbers],
    "resistance": [array of resistance levels as numbers]
  },
  "observations": [array of string observations about price action, liquidity, etc.],
  "sentiment": "very_bullish|bullish|neutral|bearish|very_bearish"
}

Focus on:
- Market structure breaks and changes
- Fair Value Gaps (FVGs)
- Order Blocks (OBs)
- Liquidity sweeps
- Break of Structure (BOS) / Change of Character (CHoCH)
- Institutional order flow

Return ONLY valid JSON, no markdown formatting or additional text.`;
};

const buildTradeRecommendationPrompt = (query: string, context: TradeContext): string => {
  const positionInfo = context.position
    ? `Current Position: ${context.position.side.toUpperCase()} ${context.position.size} @ $${context.position.entryPrice}`
    : "No open position";

  return `You are an expert cryptocurrency trader using ICT (Inner Circle Trader) methodology. Provide a trade recommendation based on the following context:

Query: ${query}
Symbol: ${context.symbol}
Account Value: $${context.accountValue.toFixed(2)}
Risk Tolerance: ${context.riskTolerance}
${positionInfo}

Provide your recommendation in the following JSON format:
{
  "recommendation": "buy|sell|hold|close",
  "confidence": number between 0-1,
  "entryZone": { "min": number, "max": number },
  "stopLoss": number,
  "targets": [{ "price": number, "probability": number }, ...],
  "reasoning": "Detailed explanation of the trade setup using ICT concepts",
  "ictAnalysis": {
    "fairValueGap": { "top": number, "bottom": number } or null,
    "orderBlock": { "price": number, "type": "bullish|bearish" } or null,
    "liquiditySweep": boolean,
    "marketStructureShift": boolean
  }
}

Consider:
- Optimal entry zones based on FVGs and OBs
- Risk management (stop loss placement)
- Multiple take profit levels
- Risk-to-reward ratio (minimum 1:2)
- Market structure confirmation
- Liquidity targets

Return ONLY valid JSON, no markdown formatting or additional text.`;
};

// Validation functions
const validateAIAnalysis = (parsed: any): boolean =>
  typeof parsed.marketStructure === "string" &&
  ["bullish", "bearish", "neutral"].includes(parsed.trend) &&
  Array.isArray(parsed.keyLevels?.support) &&
  Array.isArray(parsed.keyLevels?.resistance) &&
  Array.isArray(parsed.observations) &&
  ["very_bullish", "bullish", "neutral", "bearish", "very_bearish"].includes(parsed.sentiment);

const validateTradeRecommendation = (parsed: any): boolean =>
  ["buy", "sell", "hold", "close"].includes(parsed.recommendation) &&
  typeof parsed.confidence === "number" &&
  parsed.entryZone &&
  typeof parsed.stopLoss === "number" &&
  Array.isArray(parsed.targets) &&
  typeof parsed.reasoning === "string";

// Retry logic
const withRetry = <A, E>(
  effect: Effect.Effect<A, E, never>,
  retries = 3,
  baseDelay = 1000
): Effect.Effect<A, E, never> =>
  effect.pipe(
    Effect.retry({
      schedule: Schedule.exponential(baseDelay).pipe(Schedule.intersect(Schedule.recurs(retries))),
    }),
    Effect.catchAll((error) => Effect.fail(error))
  );

// Provider-specific request functions
const makeOpenAIRequest = (
  client: OpenAI,
  model: ModelInfo,
  messages: ChatCompletionMessageParam[],
  temperature: number,
  maxTokens: number
): Effect.Effect<{ content: string; inputTokens: number; outputTokens: number }, AIError, never> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        client.chat.completions.create({
          model: model.id,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      catch: (error) =>
        new AIError({
          message: `OpenAI API error: ${error}`,
          code: "API_ERROR",
          cause: error,
        }),
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return yield* Effect.fail(
        new AIError({
          message: "Empty response from OpenAI",
          code: "EMPTY_RESPONSE",
        })
      );
    }

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    return { content, inputTokens, outputTokens };
  });

const makeAnthropicRequest = (
  client: Anthropic,
  model: ModelInfo,
  messages: MessageParam[],
  maxTokens: number
): Effect.Effect<{ content: string; inputTokens: number; outputTokens: number }, AIError, never> =>
  Effect.gen(function* () {
    interface AnthropicResponse {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    }

    const response: AnthropicResponse = yield* Effect.tryPromise({
      try: () =>
        client.messages.create({
          model: model.id,
          max_tokens: maxTokens,
          messages,
        }) as Promise<AnthropicResponse>,
      catch: (error) =>
        new AIError({
          message: `Anthropic API error: ${error}`,
          code: "API_ERROR",
          cause: error,
        }),
    });

    const content = response.content
      .filter(
        (block): block is { type: "text"; text: string } =>
          block.type === "text" && typeof block.text === "string"
      )
      .map((block) => block.text)
      .join("");

    if (!content) {
      return yield* Effect.fail(
        new AIError({
          message: "Empty response from Anthropic",
          code: "EMPTY_RESPONSE",
        })
      );
    }

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;

    return { content, inputTokens, outputTokens };
  });

const makeGoogleRequest = (
  client: GoogleGenerativeAI,
  model: ModelInfo,
  systemPrompt: string,
  userPrompt: string
): Effect.Effect<{ content: string; inputTokens: number; outputTokens: number }, AIError, never> =>
  Effect.gen(function* () {
    const genModel = client.getGenerativeModel({
      model: model.id,
      systemInstruction: systemPrompt,
    });

    const response = yield* Effect.tryPromise({
      try: () => genModel.generateContent(userPrompt),
      catch: (error) =>
        new AIError({
          message: `Google API error: ${error}`,
          code: "API_ERROR",
          cause: error,
        }),
    });

    const content = response.response.text();
    if (!content) {
      return yield* Effect.fail(
        new AIError({
          message: "Empty response from Google",
          code: "EMPTY_RESPONSE",
        })
      );
    }

    // Google doesn't always return token counts
    const inputTokens = 0;
    const outputTokens = 0;

    return { content, inputTokens, outputTokens };
  });

// Main implementation
const makeAIService = Effect.gen(function* () {
  const config = yield* AppConfigTag;
  const registry = yield* ModelsRegistryTag;

  // Initialize clients
  const clients: Record<AIProvider, any> = {} as Record<AIProvider, any>;

  // Setup OpenAI client if configured
  if (Option.isSome(config.ai.openaiApiKey)) {
    clients.openai = createOpenAIClient(Redacted.value(config.ai.openaiApiKey.value));
  }

  // Setup Anthropic client if configured
  if (Option.isSome(config.ai.anthropicApiKey)) {
    clients.anthropic = createAnthropicClient(Redacted.value(config.ai.anthropicApiKey.value));
  }

  // Setup Google client if configured
  if (Option.isSome(config.ai.googleApiKey)) {
    clients.google = createGoogleClient(Redacted.value(config.ai.googleApiKey.value));
  }

  // Select model for task
  const selectModel = (
    task: TaskType,
    preferredProvider?: AIProvider,
    modelSelection?: ModelSelection
  ): Effect.Effect<ModelInfo, AIError, never> =>
    Effect.gen(function* () {
      // If specific model is provided, use it directly
      if (modelSelection) {
        const selectedModel = yield* registry
          .getModel(modelSelection.provider, modelSelection.modelId)
          .pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new AIError({
                  message: `Failed to get model ${modelSelection.modelId} from ${modelSelection.provider}: ${error.message}`,
                  code: "CONFIG_ERROR",
                  cause: error,
                })
              )
            )
          );

        if (Option.isSome(selectedModel)) {
          yield* Logger.logInfo(
            `Using user-selected model: ${selectedModel.value.name} (${selectedModel.value.provider})`
          );
          return selectedModel.value;
        }

        return yield* Effect.fail(
          new AIError({
            message: `Model ${modelSelection.modelId} not found for provider ${modelSelection.provider}`,
            code: "CONFIG_ERROR",
          })
        );
      }

      const capabilities = getRequiredCapabilities(task);

      // Try preferred provider first
      if (preferredProvider) {
        const preferred = yield* registry
          .findBestModel({
            provider: preferredProvider,
            capabilities,
            preferReasoning: task === "chart_analysis",
            preferLatest: true,
          })
          .pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new AIError({
                  message: `Models registry error: ${error.message}`,
                  code: "API_ERROR",
                  cause: error,
                })
              )
            )
          );

        if (Option.isSome(preferred)) {
          return preferred.value;
        }
      }

      // Try primary provider
      const primary = yield* registry
        .findBestModel({
          provider: config.ai.primaryProvider,
          capabilities,
          preferReasoning: task === "chart_analysis",
          preferLatest: true,
        })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new AIError({
                message: `Models registry error: ${error.message}`,
                code: "API_ERROR",
                cause: error,
              })
            )
          )
        );

      if (Option.isSome(primary)) {
        return primary.value;
      }

      // Try fallback provider if enabled
      if (config.ai.enableFallback) {
        const fallback = yield* registry
          .findBestModel({
            provider: config.ai.fallbackProvider,
            capabilities,
            preferReasoning: task === "chart_analysis",
            preferLatest: true,
          })
          .pipe(
            Effect.catchAll((error) =>
              Effect.fail(
                new AIError({
                  message: `Models registry error: ${error.message}`,
                  code: "API_ERROR",
                  cause: error,
                })
              )
            )
          );

        if (Option.isSome(fallback)) {
          return fallback.value;
        }
      }

      // Try any available provider
      const anyProvider = yield* registry
        .findBestModel({
          capabilities,
          preferReasoning: task === "chart_analysis",
          preferLatest: true,
        })
        .pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new AIError({
                message: `Models registry error: ${error.message}`,
                code: "API_ERROR",
                cause: error,
              })
            )
          )
        );

      if (Option.isSome(anyProvider)) {
        return anyProvider.value;
      }

      return yield* Effect.fail(
        new AIError({
          message: `No suitable model found for task: ${task}`,
          code: "CONFIG_ERROR",
        })
      );
    });

  const service: AIService = {
    analyzeChart: (context, modelSelection) =>
      Effect.gen(function* () {
        // Check cache first (only if no specific model requested)
        if (!modelSelection) {
          const cached = getCachedAnalysis(context);
          if (Option.isSome(cached)) {
            yield* Logger.logDebug(`AI cache hit for ${context.symbol}`);
            return cached.value;
          }
        }

        yield* Logger.logInfo(`Analyzing chart for ${context.symbol}`);

        // Select best model for chart analysis (or use provided model)
        const model = yield* selectModel("chart_analysis", undefined, modelSelection);
        yield* Logger.logInfo(`Using model: ${model.name} (${model.provider})`);

        const prompt = buildChartAnalysisPrompt(context);
        const systemPrompt =
          "You are a professional cryptocurrency technical analyst specializing in ICT (Inner Circle Trader) methodology. Always respond with valid JSON only.";

        // Make request based on provider
        let result: { content: string; inputTokens: number; outputTokens: number };

        switch (model.provider) {
          case "openai": {
            if (!clients.openai) {
              return yield* Effect.fail(
                new AIError({
                  message: "OpenAI client not configured",
                  code: "CONFIG_ERROR",
                })
              );
            }
            const messages: ChatCompletionMessageParam[] = [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ];
            result = yield* withRetry(
              makeOpenAIRequest(
                clients.openai,
                model,
                messages,
                config.ai.temperature,
                config.ai.maxTokens
              )
            );
            break;
          }

          case "anthropic": {
            if (!clients.anthropic) {
              return yield* Effect.fail(
                new AIError({
                  message: "Anthropic client not configured",
                  code: "CONFIG_ERROR",
                })
              );
            }
            const messages: MessageParam[] = [{ role: "user", content: prompt }];
            result = yield* withRetry(
              makeAnthropicRequest(clients.anthropic, model, messages, config.ai.maxTokens)
            );
            break;
          }

          case "google": {
            if (!clients.google) {
              return yield* Effect.fail(
                new AIError({
                  message: "Google client not configured",
                  code: "CONFIG_ERROR",
                })
              );
            }
            result = yield* withRetry(
              makeGoogleRequest(clients.google, model, systemPrompt, prompt)
            );
            break;
          }

          default:
            return yield* Effect.fail(
              new AIError({
                message: `Unsupported provider: ${model.provider}`,
                code: "CONFIG_ERROR",
              })
            );
        }

        // Track cost
        trackCost(model, result.inputTokens, result.outputTokens);
        yield* Logger.logDebug(
          `Request cost: $${((result.inputTokens * model.cost.input + result.outputTokens * model.cost.output) / 1_000_000).toFixed(4)}`
        );

        // Parse response
        const parsed = yield* Effect.try({
          try: () => JSON.parse(result.content),
          catch: () => null,
        }).pipe(
          Effect.flatMap((parsed) =>
            parsed
              ? Effect.succeed(parsed)
              : Effect.fail(
                  new AIError({
                    message: "Failed to parse AI response as JSON",
                    code: "PARSE_ERROR",
                  })
                )
          )
        );

        if (!validateAIAnalysis(parsed)) {
          return yield* Effect.fail(
            new AIError({
              message: "Invalid response structure",
              code: "VALIDATION_ERROR",
            })
          );
        }

        const analysisResult: AIAnalysis = {
          marketStructure: parsed.marketStructure,
          trend: parsed.trend,
          keyLevels: parsed.keyLevels,
          observations: parsed.observations,
          sentiment: parsed.sentiment,
        };

        // Cache the result
        setCachedAnalysis(context, analysisResult);
        yield* Logger.logInfo(`AI analysis cached for ${context.symbol}`);

        return analysisResult;
      }).pipe(
        Effect.catchAll((error) => {
          if (error instanceof AIError) {
            return Effect.fail(error);
          }
          return Effect.fail(
            new AIError({
              message: `Unexpected error: ${error}`,
              code: "API_ERROR",
              cause: error,
            })
          );
        })
      ),

    getRecommendation: (query, context, modelSelection) =>
      Effect.gen(function* () {
        yield* Logger.logInfo(`Generating recommendation for ${context.symbol}`);

        // Select best model for trade recommendation (or use provided model)
        const model = yield* selectModel("trade_recommendation", undefined, modelSelection);
        yield* Logger.logInfo(`Using model: ${model.name} (${model.provider})`);

        const prompt = buildTradeRecommendationPrompt(query, context);
        const systemPrompt =
          "You are a professional cryptocurrency trader using ICT methodology. Provide detailed trade recommendations with specific entry zones, stop losses, and targets. Always respond with valid JSON only.";

        // Make request based on provider
        let result: { content: string; inputTokens: number; outputTokens: number };

        switch (model.provider) {
          case "openai": {
            if (!clients.openai) {
              return yield* Effect.fail(
                new AIError({
                  message: "OpenAI client not configured",
                  code: "CONFIG_ERROR",
                })
              );
            }
            const messages: ChatCompletionMessageParam[] = [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ];
            result = yield* withRetry(
              makeOpenAIRequest(
                clients.openai,
                model,
                messages,
                config.ai.temperature,
                config.ai.maxTokens
              )
            );
            break;
          }

          case "anthropic": {
            if (!clients.anthropic) {
              return yield* Effect.fail(
                new AIError({
                  message: "Anthropic client not configured",
                  code: "CONFIG_ERROR",
                })
              );
            }
            const messages: MessageParam[] = [{ role: "user", content: prompt }];
            result = yield* withRetry(
              makeAnthropicRequest(clients.anthropic, model, messages, config.ai.maxTokens)
            );
            break;
          }

          case "google": {
            if (!clients.google) {
              return yield* Effect.fail(
                new AIError({
                  message: "Google client not configured",
                  code: "CONFIG_ERROR",
                })
              );
            }
            result = yield* withRetry(
              makeGoogleRequest(clients.google, model, systemPrompt, prompt)
            );
            break;
          }

          default:
            return yield* Effect.fail(
              new AIError({
                message: `Unsupported provider: ${model.provider}`,
                code: "CONFIG_ERROR",
              })
            );
        }

        // Track cost
        trackCost(model, result.inputTokens, result.outputTokens);

        // Parse response
        const parsed = yield* Effect.try({
          try: () => JSON.parse(result.content),
          catch: () => null,
        }).pipe(
          Effect.flatMap((parsed) =>
            parsed
              ? Effect.succeed(parsed)
              : Effect.fail(
                  new AIError({
                    message: "Failed to parse AI response as JSON",
                    code: "PARSE_ERROR",
                  })
                )
          )
        );

        if (!validateTradeRecommendation(parsed)) {
          return yield* Effect.fail(
            new AIError({
              message: "Invalid recommendation structure",
              code: "VALIDATION_ERROR",
            })
          );
        }

        const recResult: TradeRecommendation = {
          recommendation: parsed.recommendation,
          confidence: parsed.confidence,
          entryZone: parsed.entryZone,
          stopLoss: parsed.stopLoss,
          targets: parsed.targets,
          reasoning: parsed.reasoning,
          ictAnalysis: parsed.ictAnalysis || {
            fairValueGap: undefined,
            orderBlock: undefined,
            liquiditySweep: false,
            marketStructureShift: false,
          },
        };

        yield* Logger.logInfo(`Recommendation generated for ${context.symbol}`);
        return recResult;
      }).pipe(
        Effect.catchAll((error) => {
          if (error instanceof AIError) {
            return Effect.fail(error);
          }
          return Effect.fail(
            new AIError({
              message: `Unexpected error: ${error}`,
              code: "API_ERROR",
              cause: error,
            })
          );
        })
      ),

    streamAnalysis: (context, modelSelection) => {
      const createStream = Effect.gen(function* () {
        yield* Logger.logInfo(`Starting streaming analysis for ${context.symbol}`);

        // For streaming, prefer OpenAI for now (best streaming support) unless specific model provided
        const preferredProvider = modelSelection ? modelSelection.provider : "openai";
        const model = yield* selectModel(
          "streaming",
          preferredProvider as AIProvider,
          modelSelection
        );

        if (model.provider !== "openai" || !clients.openai) {
          // Fallback to non-streaming if OpenAI not available
          yield* Logger.logWarn(
            `Streaming not available for ${model.provider}, using non-streaming`
          );

          // Create a stream that runs the analysis
          const fallbackStream = Stream.fromEffect(
            service.analyzeChart(context, modelSelection).pipe(
              Effect.map(
                (analysis): AIChunk => ({ type: "chunk", content: JSON.stringify(analysis) })
              ),
              Effect.catchAll(
                (error): Effect.Effect<AIChunk, AIStreamingError, never> =>
                  Effect.fail(
                    new AIStreamingError({
                      message: `Failed to get analysis: ${error.message}`,
                      code: "STREAM_ERROR",
                      cause: error,
                    })
                  )
              )
            )
          );

          return fallbackStream;
        }

        const prompt = buildChartAnalysisPrompt(context);
        const messages: ChatCompletionMessageParam[] = [
          {
            role: "system",
            content:
              "You are a professional cryptocurrency technical analyst specializing in ICT methodology. Provide streaming analysis with real-time insights.",
          },
          { role: "user", content: prompt },
        ];

        interface StreamChunk {
          choices: Array<{
            delta: {
              content?: string;
            };
          }>;
        }

        const streamPromise: Promise<AsyncIterable<StreamChunk>> =
          clients.openai.chat.completions.create({
            model: model.id,
            messages,
            temperature: config.ai.temperature,
            max_tokens: config.ai.maxTokens,
            stream: true,
          });

        const stream: AsyncIterable<StreamChunk> = yield* Effect.tryPromise({
          try: () => streamPromise,
          catch: (error) =>
            new AIStreamingError({
              message: `Failed to create stream: ${error}`,
              code: "STREAM_ERROR",
              cause: error,
            }),
        });

        const resultStream: Stream.Stream<AIChunk, AIStreamingError, never> =
          Stream.fromAsyncIterable(
            stream,
            (error) =>
              new AIStreamingError({
                message: `Stream error: ${error}`,
                code: "STREAM_ERROR",
                cause: error,
              })
          ).pipe(
            Stream.map((chunk: StreamChunk): AIChunk => {
              const content = chunk.choices[0]?.delta?.content || "";
              return {
                type: "chunk",
                content,
              };
            }),
            Stream.tap((chunk) =>
              Logger.logDebug(`Streaming chunk: ${chunk.content?.slice(0, 50)}...`)
            )
          );

        return resultStream;
      }).pipe(
        Effect.catchAll((error) =>
          Effect.succeed(
            Stream.fail(
              new AIStreamingError({
                message: `Stream creation failed: ${error}`,
                code: "STREAM_ERROR",
                cause: error,
              })
            )
          )
        )
      );

      return Stream.unwrap(createStream);
    },

    clearCache: (symbol, timeframe) =>
      Effect.sync(() => {
        clearCacheEntry(symbol, timeframe);
      }),
  };

  return service;
});

// Live Layer - includes ModelsRegistry dependency
export const AIServiceLive = Layer.effect(AIServiceTag, makeAIService).pipe(
  Layer.provide(ModelsRegistryLive)
);
