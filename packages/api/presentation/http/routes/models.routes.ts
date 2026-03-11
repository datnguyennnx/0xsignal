/** Models Routes - Available AI models for frontend selection */

import { Effect, Option } from "effect";
import { ModelsRegistryTag, type ModelInfo } from "../../../services/models-registry";

// Simplified model info for the frontend
export interface FrontendModel {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly providerName: string;
  readonly reasoning: boolean;
  readonly costInput: number;
  readonly costOutput: number;
  readonly contextWindow: number;
}

export interface FrontendProvider {
  readonly id: string;
  readonly name: string;
  readonly models: FrontendModel[];
}

const toFrontendModel = (model: ModelInfo, providerName: string): FrontendModel => ({
  id: model.id,
  name: model.name,
  provider: model.provider,
  providerName,
  reasoning: model.reasoning,
  costInput: model.cost.input,
  costOutput: model.cost.output,
  contextWindow: model.limit.context,
});

// GET /api/models - List available AI models grouped by provider
export const listModelsRoute = () =>
  Effect.gen(function* () {
    const registry = yield* ModelsRegistryTag;
    const providers = yield* registry.getConfiguredProviders;

    const result: FrontendProvider[] = Object.entries(providers)
      .filter(([id]) => ["openai", "anthropic", "google"].includes(id))
      .map(([id, provider]) => ({
        id,
        name: provider.name,
        models: Object.values(provider.models)
          // Filter to text models only, sort by release date descending
          .filter(
            (m) => m.modalities.input.includes("text") && m.modalities.output.includes("text")
          )
          .sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())
          .slice(0, 10) // Top 10 per provider
          .map((m) => toFrontendModel(m, provider.name)),
      }))
      .filter((p) => p.models.length > 0);

    return { providers: result };
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail({
        status: 500,
        message: `Failed to load models: ${error}`,
      })
    )
  );
