import { Effect } from "effect";
import { validationError, notFoundError, DomainError } from "./errors";
import type {
  StrategyDefinition,
  StrategyVersion,
  StrategyChangeRecord,
  StrategyHistory,
} from "../schemas/strategy";
import type { StrategyRepository } from "../infrastructure/repositories/strategy-repo";

type CreateStrategyDefinitionInput = {
  id: string;
  slug: string;
  name: string;
  market_type: "crypto" | "forex" | "equity" | "commodity";
  owner_type: "user" | "system" | "shared";
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
};

type CreateStrategyVersionInput = {
  id: string;
  strategy_id: string;
  parent_version_id?: string;
  version: number;
  config: string | unknown;
  change_reason?: string;
  created_by_action_id?: string;
  schema_version: string;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
};

type RecordStrategyChangeInput = {
  id: string;
  strategy_version_id: string;
  change_type: "create" | "update" | "delete" | "restore";
  path: string;
  previous_value?: string | unknown;
  next_value?: string | unknown;
  summary?: string;
  trace_id?: string;
  span_id?: string;
  correlation_id?: string;
};

export interface StrategyServices {
  createStrategyDefinition(
    input: CreateStrategyDefinitionInput
  ): Effect.Effect<StrategyDefinition, DomainError, never>;
  createStrategyVersion(
    input: CreateStrategyVersionInput
  ): Effect.Effect<StrategyVersion, DomainError, never>;
  recordStrategyChange(
    input: RecordStrategyChangeInput
  ): Effect.Effect<StrategyChangeRecord, DomainError, never>;
  getStrategyHistory(id: string): Effect.Effect<StrategyHistory, DomainError, never>;
}

export const makeStrategyService = (repo: StrategyRepository): StrategyServices => ({
  createStrategyDefinition: (
    input: CreateStrategyDefinitionInput
  ): Effect.Effect<StrategyDefinition, DomainError, never> =>
    Effect.tryPromise({
      try: () =>
        repo.insertDefinition({
          id: input.id,
          slug: input.slug,
          name: input.name,
          market_type: input.market_type,
          owner_type: input.owner_type,
          created_at: new Date().toISOString(),
        }),
      catch: (e) => validationError("Failed to create strategy definition", e),
    }),

  createStrategyVersion: (
    input: CreateStrategyVersionInput
  ): Effect.Effect<StrategyVersion, DomainError, never> =>
    Effect.tryPromise({
      try: () =>
        repo.insertVersion({
          id: input.id,
          strategy_id: input.strategy_id,
          parent_version_id: input.parent_version_id,
          version: input.version,
          config: input.config,
          change_reason: input.change_reason,
          created_by_action_id: input.created_by_action_id,
          schema_version: input.schema_version,
          trace_id: input.trace_id,
          span_id: input.span_id,
          correlation_id: input.correlation_id,
          created_at: new Date().toISOString(),
        }),
      catch: (e) => validationError("Failed to create strategy version", e),
    }),

  recordStrategyChange: (
    input: RecordStrategyChangeInput
  ): Effect.Effect<StrategyChangeRecord, DomainError, never> =>
    Effect.tryPromise({
      try: () =>
        repo.insertChangeRecord({
          id: input.id,
          strategy_version_id: input.strategy_version_id,
          change_type: input.change_type,
          path: input.path,
          previous_value: input.previous_value,
          next_value: input.next_value,
          summary: input.summary,
          trace_id: input.trace_id,
          span_id: input.span_id,
          correlation_id: input.correlation_id,
          created_at: new Date().toISOString(),
        }),
      catch: (e) => validationError("Failed to record strategy change", e),
    }),

  getStrategyHistory: (id: string): Effect.Effect<StrategyHistory, DomainError, never> =>
    Effect.gen(function* () {
      const history = yield* Effect.tryPromise({
        try: () => repo.getHistory(id),
        catch: (e) => validationError("Failed to get strategy history", e),
      });
      if (!history) {
        return yield* Effect.fail(notFoundError(`Strategy ${id} not found`));
      }
      return history;
    }),
});
