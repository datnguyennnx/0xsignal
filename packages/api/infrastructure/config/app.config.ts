/** Application Configuration - Type-safe config using Effect Config */

import { Config, Context, Duration, Effect, Layer, Option, Redacted } from "effect";

// AI Provider Types
export type AIProvider = "openai" | "anthropic" | "google";

// Model selection strategy based on task complexity
export type TaskType = "chart_analysis" | "trade_recommendation" | "streaming";

// Cost tracking per model (per 1M tokens)
export interface ModelPricing {
  inputCost: number; // USD per 1M input tokens
  outputCost: number; // USD per 1M output tokens
  contextWindow: number; // Max context size
}

// Supported models with pricing (Feb 2025)
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI models
  "o3-pro": { inputCost: 20.0, outputCost: 80.0, contextWindow: 128000 },
  "gpt-4.5": { inputCost: 75.0, outputCost: 150.0, contextWindow: 256000 },
  "gpt-4o": { inputCost: 2.5, outputCost: 10.0, contextWindow: 128000 },
  "gpt-4o-mini": { inputCost: 0.15, outputCost: 0.6, contextWindow: 128000 },
  // Anthropic models
  "claude-4-opus": { inputCost: 15.0, outputCost: 75.0, contextWindow: 200000 },
  "claude-3-5-sonnet": { inputCost: 3.0, outputCost: 15.0, contextWindow: 200000 },
  // Google models
  "gemini-2.5-pro": { inputCost: 1.25, outputCost: 10.0, contextWindow: 2000000 },
  "gemini-1.5-pro": { inputCost: 3.5, outputCost: 10.5, contextWindow: 2000000 },
};

// Default models by task type
export const DEFAULT_MODELS: Record<TaskType, string> = {
  chart_analysis: "o3-pro", // Complex reasoning for technical analysis
  trade_recommendation: "gpt-4.5", // Structured output with high accuracy
  streaming: "gpt-4o", // Fast responses for real-time streaming
};

// AI Configuration with multi-provider support
export const AIConfig = Config.all({
  // Primary provider (main AI service)
  primaryProvider: Config.string("AI_PRIMARY_PROVIDER").pipe(
    Config.withDefault("openai")
  ) as Config.Config<AIProvider>,

  // Fallback provider (if primary fails)
  fallbackProvider: Config.string("AI_FALLBACK_PROVIDER").pipe(
    Config.withDefault("google")
  ) as Config.Config<AIProvider>,

  // OpenAI config
  openaiApiKey: Config.redacted("OPENAI_API_KEY").pipe(Config.option),
  openaiChartModel: Config.string("OPENAI_CHART_MODEL").pipe(
    Config.withDefault(DEFAULT_MODELS.chart_analysis)
  ),
  openaiTradeModel: Config.string("OPENAI_TRADE_MODEL").pipe(
    Config.withDefault(DEFAULT_MODELS.trade_recommendation)
  ),
  openaiStreamModel: Config.string("OPENAI_STREAM_MODEL").pipe(
    Config.withDefault(DEFAULT_MODELS.streaming)
  ),

  // Anthropic config
  anthropicApiKey: Config.redacted("ANTHROPIC_API_KEY").pipe(Config.option),
  anthropicChartModel: Config.string("ANTHROPIC_CHART_MODEL").pipe(
    Config.withDefault("claude-4-opus")
  ),
  anthropicTradeModel: Config.string("ANTHROPIC_TRADE_MODEL").pipe(
    Config.withDefault("claude-3-5-sonnet")
  ),
  anthropicStreamModel: Config.string("ANTHROPIC_STREAM_MODEL").pipe(
    Config.withDefault("claude-3-5-sonnet")
  ),

  // Google config
  googleApiKey: Config.redacted("GOOGLE_API_KEY").pipe(Config.option),
  googleChartModel: Config.string("GOOGLE_CHART_MODEL").pipe(Config.withDefault("gemini-2.5-pro")),
  googleTradeModel: Config.string("GOOGLE_TRADE_MODEL").pipe(Config.withDefault("gemini-2.5-pro")),
  googleStreamModel: Config.string("GOOGLE_STREAM_MODEL").pipe(
    Config.withDefault("gemini-2.5-pro")
  ),

  // Generation settings
  temperature: Config.number("AI_TEMPERATURE").pipe(Config.withDefault(0.1)),
  maxTokens: Config.number("AI_MAX_TOKENS").pipe(Config.withDefault(4000)),

  // Feature flags
  enableCostTracking: Config.boolean("AI_ENABLE_COST_TRACKING").pipe(Config.withDefault(true)),
  enableFallback: Config.boolean("AI_ENABLE_FALLBACK").pipe(Config.withDefault(true)),
});

export type AIConfig = Config.Config.Success<typeof AIConfig>;

// Helper to get model for task type
export const getModelForTask = (config: AIConfig, provider: AIProvider, task: TaskType): string => {
  const models = {
    openai: {
      chart_analysis: config.openaiChartModel,
      trade_recommendation: config.openaiTradeModel,
      streaming: config.openaiStreamModel,
    },
    anthropic: {
      chart_analysis: config.anthropicChartModel,
      trade_recommendation: config.anthropicTradeModel,
      streaming: config.anthropicStreamModel,
    },
    google: {
      chart_analysis: config.googleChartModel,
      trade_recommendation: config.googleTradeModel,
      streaming: config.googleStreamModel,
    },
  };
  return models[provider][task];
};

// Environment config
export const EnvConfig = Config.all({
  coingeckoApiKey: Config.string("COINGECKO_API_KEY").pipe(Config.withDefault("")),
  port: Config.number("PORT").pipe(Config.withDefault(9006)),
  logLevel: Config.string("LOG_LEVEL").pipe(Config.withDefault("info")),
  enablePrewarm: Config.boolean("ENABLE_PREWARM").pipe(Config.withDefault(true)),
});

export type EnvConfig = Config.Config.Success<typeof EnvConfig>;

// App config service
export interface AppConfig {
  readonly env: EnvConfig;
  readonly ai: AIConfig;
  readonly api: typeof API_URLS;
  readonly cache: typeof CACHE_TTL;
  readonly limits: typeof DEFAULT_LIMITS;
  readonly ws: typeof WS_CONFIG;
}

export class AppConfigTag extends Context.Tag("AppConfig")<AppConfigTag, AppConfig>() {}

export const AppConfigLive = Layer.effect(
  AppConfigTag,
  Effect.gen(function* () {
    const env = yield* EnvConfig;
    const ai = yield* AIConfig;
    return { env, ai, api: API_URLS, cache: CACHE_TTL, limits: DEFAULT_LIMITS, ws: WS_CONFIG };
  })
);

// API URLs
export const API_URLS = {
  COINGECKO: "https://api.coingecko.com/api/v3",
} as const;

// Cache TTL
export const CACHE_TTL = {
  COINGECKO_PRICE: Duration.minutes(5),
  COINGECKO_TOP_CRYPTOS: Duration.minutes(5),
  COINGECKO_HISTORICAL: Duration.minutes(60), // Historical data changes less often
  HEATMAP: Duration.minutes(5),
  ANALYSIS: Duration.minutes(1), // Fast signal updates
  BUYBACK_SIGNALS: Duration.minutes(15),
  BUYBACK_OVERVIEW: Duration.minutes(15),
  BUYBACK_PROTOCOL: Duration.minutes(15),
  TREASURY_HOLDINGS: Duration.hours(1), // Very slow changing
  TREASURY_TRANSACTIONS: Duration.hours(1), // Slow changing
  TREASURY_ENTITIES: Duration.hours(24),
} as const;

// Cache capacity
export const CACHE_CAPACITY = {
  DEFAULT: 100,
  LARGE: 200,
  SMALL: 20,
  SINGLE: 10,
} as const;

// Rate limits
export const RATE_LIMITS = {
  COINGECKO: 30,
} as const;

// Default limits
export const DEFAULT_LIMITS = {
  TOP_CRYPTOS: 100,
  TOP_CRYPTOS_EXTENDED: 250,
  ANALYSIS_ASSETS: 100,
  BUYBACK_SIGNALS: 50,
  HEATMAP: 100,
  MAX_HEATMAP: 200,
} as const;

// WebSocket config
export const WS_CONFIG = {
  RECONNECT_DELAY_MS: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
  PING_INTERVAL_MS: 30000,
  PONG_TIMEOUT_MS: 10000,
  CLEANUP_INTERVAL: Duration.minutes(1),
} as const;
