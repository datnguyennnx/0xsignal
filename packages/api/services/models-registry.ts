/** Models Registry Service - Fetches and manages AI models from models.dev API */

import { Effect, Context, Layer, Schedule, Data, Option, Config, Ref } from "effect";
import type { Redacted } from "effect";

// Domain Types
export interface ModelCost {
  readonly input: number; // Cost per input token
  readonly output: number; // Cost per output token
  readonly cache_read?: number; // Cache read cost (optional)
  readonly cache_write?: number; // Cache write cost (optional)
  readonly reasoning?: number; // Reasoning token cost (optional)
}

export interface ModelLimit {
  readonly context: number; // Maximum context window
  readonly output: number; // Maximum output tokens
}

export interface ModelModalities {
  readonly input: readonly string[]; // ["text", "image", "video", "audio", "pdf"]
  readonly output: readonly string[]; // ["text", "image"]
}

export interface ModelInfo {
  readonly id: string;
  readonly name: string;
  readonly family: string;
  readonly provider: string;
  readonly attachment: boolean;
  readonly reasoning: boolean;
  readonly tool_call: boolean;
  readonly structured_output: boolean;
  readonly temperature: boolean;
  readonly knowledge: string; // Knowledge cutoff date
  readonly release_date: string; // YYYY-MM-DD
  readonly last_updated?: string; // YYYY-MM-DD
  readonly modalities: ModelModalities;
  readonly open_weights: boolean;
  readonly cost: ModelCost;
  readonly limit: ModelLimit;
}

export interface ProviderInfo {
  readonly id: string;
  readonly name: string;
  readonly npm: string;
  readonly api: string | null;
  readonly doc: string | null;
  readonly env: readonly string[];
  readonly models: Readonly<Record<string, ModelInfo>>;
}

export type ModelsRegistryData = Readonly<Record<string, ProviderInfo>>;

// Errors
export class ModelsRegistryError extends Data.TaggedError("ModelsRegistryError")<{
  readonly message: string;
  readonly code: "FETCH_ERROR" | "PARSE_ERROR" | "CACHE_ERROR";
  readonly cause?: unknown;
}> {}

// Service Interface
export interface ModelsRegistryService {
  /** Refresh the models data from API */
  readonly refresh: Effect.Effect<void, ModelsRegistryError, never>;

  /** Get all providers */
  readonly getProviders: Effect.Effect<ModelsRegistryData, ModelsRegistryError, never>;

  /** Get configured providers (those with API keys set) */
  readonly getConfiguredProviders: Effect.Effect<ModelsRegistryData, ModelsRegistryError, never>;

  /** Get specific provider */
  readonly getProvider: (
    id: string
  ) => Effect.Effect<Option.Option<ProviderInfo>, ModelsRegistryError, never>;

  /** Get all models from a provider */
  readonly getProviderModels: (
    providerId: string
  ) => Effect.Effect<ReadonlyArray<ModelInfo>, ModelsRegistryError, never>;

  /** Get specific model */
  readonly getModel: (
    providerId: string,
    modelId: string
  ) => Effect.Effect<Option.Option<ModelInfo>, ModelsRegistryError, never>;

  /** Find best model by criteria */
  readonly findBestModel: (
    criteria: ModelCriteria
  ) => Effect.Effect<Option.Option<ModelInfo>, ModelsRegistryError, never>;

  /** Get models supporting specific capability */
  readonly getModelsByCapability: (
    capability: ModelCapability
  ) => Effect.Effect<ReadonlyArray<ModelInfo>, ModelsRegistryError, never>;

  /** Get models by provider with capability */
  readonly getProviderModelsByCapability: (
    providerId: string,
    capability: ModelCapability
  ) => Effect.Effect<ReadonlyArray<ModelInfo>, ModelsRegistryError, never>;

  /** Calculate estimated cost for a request */
  readonly calculateCost: (
    model: ModelInfo,
    inputTokens: number,
    outputTokens: number
  ) => Effect.Effect<number, never, never>;
}

export type ModelCapability =
  | "reasoning"
  | "tool_call"
  | "structured_output"
  | "attachment"
  | "image_input"
  | "pdf_input";

export interface ModelCriteria {
  readonly provider?: string; // Specific provider (optional)
  readonly capabilities?: ModelCapability[]; // Required capabilities
  readonly maxCostPer1M?: number; // Max cost per 1M tokens
  readonly minContextWindow?: number; // Minimum context window
  readonly preferReasoning?: boolean; // Prefer reasoning models
  readonly preferLatest?: boolean; // Prefer latest release
}

// Service Tag
export class ModelsRegistryTag extends Context.Tag("ModelsRegistry")<
  ModelsRegistryTag,
  ModelsRegistryService
>() {}

// Cache reference type
interface RegistryCache {
  data: ModelsRegistryData;
  lastUpdated: number;
}

// Configuration
const REGISTRY_CONFIG = {
  API_URL: "https://models.dev/api.json",
  CACHE_TTL_MS: 60 * 60 * 1000, // 1 hour
  REFRESH_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Check if a provider is configured based on our app's env vars
const isProviderConfigured = (providerId: string): boolean => {
  const envVars: Record<string, string[]> = {
    openai: ["OPENAI_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY"],
    google: ["GOOGLE_API_KEY"],
  };

  const varsToCheck = envVars[providerId];
  if (!varsToCheck) return true; // Unknown provider, allow it

  // Check if at least one env var is set and not empty
  return varsToCheck.some((envVar) => {
    const value = process.env[envVar];
    return value !== undefined && value.trim() !== "";
  });
};

// Filter data to only include configured providers
const filterConfiguredProviders = (data: ModelsRegistryData): ModelsRegistryData => {
  const filtered: Record<string, ProviderInfo> = {};
  for (const [providerId, provider] of Object.entries(data)) {
    if (isProviderConfigured(providerId)) {
      filtered[providerId] = provider;
    }
  }
  return filtered;
};

// Implementation
const makeModelsRegistryService = Effect.gen(function* () {
  // Cache reference
  const cacheRef = yield* Ref.make<Option.Option<RegistryCache>>(Option.none());

  // Fetch data from API
  const fetchModelsData = Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(REGISTRY_CONFIG.API_URL),
      catch: (error) =>
        new ModelsRegistryError({
          message: `Failed to fetch models data: ${error}`,
          code: "FETCH_ERROR",
          cause: error,
        }),
    });

    if (!response.ok) {
      return yield* Effect.fail(
        new ModelsRegistryError({
          message: `HTTP error ${response.status}: ${response.statusText}`,
          code: "FETCH_ERROR",
        })
      );
    }

    const rawData = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (error) =>
        new ModelsRegistryError({
          message: `Failed to parse JSON: ${error}`,
          code: "PARSE_ERROR",
          cause: error,
        }),
    });

    // Transform raw data to add provider reference to each model
    const processedData: Record<string, ProviderInfo> = {};

    for (const [providerId, providerData] of Object.entries(rawData)) {
      const provider = providerData as Omit<ProviderInfo, "models"> & {
        models: Record<string, Omit<ModelInfo, "provider">>;
      };

      const models: Record<string, ModelInfo> = {};
      for (const [modelId, modelData] of Object.entries(provider.models)) {
        models[modelId] = {
          ...modelData,
          id: modelId,
          provider: providerId,
        } as ModelInfo;
      }

      processedData[providerId] = {
        ...provider,
        id: providerId,
        models,
      };
    }

    return processedData as ModelsRegistryData;
  });

  // Refresh cache
  const refreshCache = Effect.gen(function* () {
    const data = yield* fetchModelsData;
    yield* Ref.set(
      cacheRef,
      Option.some({
        data,
        lastUpdated: Date.now(),
      })
    );
  });

  // Get cached data or fetch fresh
  const getCachedData = Effect.gen(function* () {
    const cached = yield* Ref.get(cacheRef);

    if (Option.isSome(cached)) {
      const age = Date.now() - cached.value.lastUpdated;
      if (age < REGISTRY_CONFIG.CACHE_TTL_MS) {
        return cached.value.data;
      }
    }

    // Fetch fresh data
    yield* refreshCache;
    const fresh = yield* Ref.get(cacheRef);

    if (Option.isNone(fresh)) {
      return yield* Effect.fail(
        new ModelsRegistryError({
          message: "Failed to load models data",
          code: "CACHE_ERROR",
        })
      );
    }

    return fresh.value.data;
  }).pipe(
    Effect.catchAll((error) => {
      if (error instanceof ModelsRegistryError) {
        return Effect.fail(error);
      }
      return Effect.fail(
        new ModelsRegistryError({
          message: `Unexpected error: ${error}`,
          code: "CACHE_ERROR",
          cause: error,
        })
      );
    })
  );

  // Service implementation
  const service: ModelsRegistryService = {
    refresh: Effect.gen(function* () {
      yield* refreshCache;
    }),

    getProviders: Effect.gen(function* () {
      const data = yield* getCachedData;
      return filterConfiguredProviders(data);
    }),

    getConfiguredProviders: Effect.gen(function* () {
      const data = yield* getCachedData;
      return filterConfiguredProviders(data);
    }),

    getProvider: (id) =>
      Effect.gen(function* () {
        const data = yield* getCachedData;
        const provider = data[id];
        // Only return provider if it's configured
        if (provider && isProviderConfigured(id)) {
          return Option.some(provider);
        }
        return Option.none();
      }),

    getProviderModels: (providerId) =>
      Effect.gen(function* () {
        const data = yield* getCachedData;
        const provider = data[providerId];
        // Only return models if provider is configured
        if (!provider || !isProviderConfigured(providerId)) return [];
        return Object.values(provider.models);
      }),

    getModel: (providerId, modelId) =>
      Effect.gen(function* () {
        const data = yield* getCachedData;
        const provider = data[providerId];
        // Only return model if provider is configured
        if (!provider || !isProviderConfigured(providerId)) return Option.none();
        return Option.fromNullable(provider.models[modelId]);
      }),

    findBestModel: (criteria) =>
      Effect.gen(function* () {
        const data = yield* getCachedData;

        let candidates: ModelInfo[] = [];

        // Collect candidates from configured providers only
        if (criteria.provider) {
          const provider = data[criteria.provider];
          if (provider && isProviderConfigured(criteria.provider)) {
            candidates = Object.values(provider.models);
          }
        } else {
          candidates = Object.entries(data)
            .filter(([providerId, _]) => isProviderConfigured(providerId))
            .flatMap(([_, p]) => Object.values(p.models));
        }

        // Filter by capabilities
        if (criteria.capabilities && criteria.capabilities.length > 0) {
          candidates = candidates.filter((model) =>
            criteria.capabilities!.every((cap) => {
              switch (cap) {
                case "reasoning":
                  return model.reasoning;
                case "tool_call":
                  return model.tool_call;
                case "structured_output":
                  return model.structured_output;
                case "attachment":
                  return model.attachment;
                case "image_input":
                  return model.modalities.input.includes("image");
                case "pdf_input":
                  return model.modalities.input.includes("pdf");
                default:
                  return false;
              }
            })
          );
        }

        // Filter by max cost
        if (criteria.maxCostPer1M) {
          candidates = candidates.filter(
            (model) =>
              model.cost.input <= criteria.maxCostPer1M! &&
              model.cost.output <= criteria.maxCostPer1M!
          );
        }

        // Filter by context window
        if (criteria.minContextWindow) {
          candidates = candidates.filter(
            (model) => model.limit.context >= criteria.minContextWindow!
          );
        }

        if (candidates.length === 0) {
          return Option.none();
        }

        // Score and sort candidates
        const scored = candidates.map((model) => {
          let score = 0;

          // Prefer reasoning models
          if (criteria.preferReasoning && model.reasoning) {
            score += 10;
          }

          // Prefer latest models (by release date)
          if (criteria.preferLatest) {
            const releaseTime = new Date(model.release_date).getTime();
            score += releaseTime / (1000 * 60 * 60 * 24 * 365); // Normalize to years
          }

          // Prefer lower cost
          score -= (model.cost.input + model.cost.output) * 0.1;

          // Prefer larger context
          score += model.limit.context / 100000;

          return { model, score };
        });

        scored.sort((a, b) => b.score - a.score);

        return Option.some(scored[0].model);
      }),

    getModelsByCapability: (capability) =>
      Effect.gen(function* () {
        const data = yield* getCachedData;
        const allModels = Object.entries(data)
          .filter(([providerId, _]) => isProviderConfigured(providerId))
          .flatMap(([_, p]) => Object.values(p.models));

        return allModels.filter((model) => {
          switch (capability) {
            case "reasoning":
              return model.reasoning;
            case "tool_call":
              return model.tool_call;
            case "structured_output":
              return model.structured_output;
            case "attachment":
              return model.attachment;
            case "image_input":
              return model.modalities.input.includes("image");
            case "pdf_input":
              return model.modalities.input.includes("pdf");
            default:
              return false;
          }
        });
      }),

    getProviderModelsByCapability: (providerId, capability) =>
      Effect.gen(function* () {
        const data = yield* getCachedData;
        const provider = data[providerId];
        // Only return models if provider is configured
        if (!provider || !isProviderConfigured(providerId)) return [];

        return Object.values(provider.models).filter((model) => {
          switch (capability) {
            case "reasoning":
              return model.reasoning;
            case "tool_call":
              return model.tool_call;
            case "structured_output":
              return model.structured_output;
            case "attachment":
              return model.attachment;
            case "image_input":
              return model.modalities.input.includes("image");
            case "pdf_input":
              return model.modalities.input.includes("pdf");
            default:
              return false;
          }
        });
      }),

    calculateCost: (model, inputTokens, outputTokens) =>
      Effect.gen(function* () {
        const inputCost = (inputTokens / 1_000_000) * model.cost.input;
        const outputCost = (outputTokens / 1_000_000) * model.cost.output;
        return inputCost + outputCost;
      }),
  };

  // Initial load
  yield* Effect.gen(function* () {
    yield* refreshCache;
  });

  return service;
});

// Live Layer
export const ModelsRegistryLive = Layer.effect(ModelsRegistryTag, makeModelsRegistryService);
