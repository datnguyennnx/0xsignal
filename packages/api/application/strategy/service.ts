import { Effect, Context, Layer } from "effect";
import { DomainError } from "../errors";
import type {
  StrategyDefinition,
  StrategyVersion,
  StrategyChangeRecord,
  StrategyHistory,
} from "../../schemas/strategy";
import { StrategyRepository } from "../ports/strategy-repository";

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

export class StrategyServices extends Context.Tag("StrategyServices")<
  StrategyServices,
  {
    readonly createStrategyDefinition: (
      input: CreateStrategyDefinitionInput
    ) => Effect.Effect<StrategyDefinition, DomainError>;
    readonly createStrategyVersion: (
      input: CreateStrategyVersionInput
    ) => Effect.Effect<StrategyVersion, DomainError>;
    readonly recordStrategyChange: (
      input: RecordStrategyChangeInput
    ) => Effect.Effect<StrategyChangeRecord, DomainError>;
    readonly getStrategyHistory: (id: string) => Effect.Effect<StrategyHistory, DomainError>;
  }
>() {}

export const makeStrategyService = (repo: StrategyRepository) =>
  StrategyServices.of({
    createStrategyDefinition: (input: CreateStrategyDefinitionInput) =>
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
        catch: (e) => {
          if (
            typeof e === "object" &&
            e !== null &&
            "code" in e &&
            (e as { code?: string }).code === "23505"
          ) {
            return new DomainError({
              code: "ALREADY_EXISTS",
              message: `Strategy slug '${input.slug}' already exists`,
              cause: e,
            });
          }

          return new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to create strategy definition",
            cause: e,
          });
        },
      }),

    createStrategyVersion: (input: CreateStrategyVersionInput) =>
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
        catch: (e) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to create strategy version",
            cause: e,
          }),
      }),

    recordStrategyChange: (input: RecordStrategyChangeInput) =>
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
        catch: (e) =>
          new DomainError({
            code: "VALIDATION_ERROR",
            message: "Failed to record strategy change",
            cause: e,
          }),
      }),

    getStrategyHistory: (id: string) =>
      Effect.gen(function* () {
        const history = yield* Effect.tryPromise({
          try: () => repo.getHistory(id),
          catch: (e) =>
            new DomainError({
              code: "VALIDATION_ERROR",
              message: "Failed to get strategy history",
              cause: e,
            }),
        });
        if (!history) {
          return yield* Effect.fail(
            new DomainError({ code: "NOT_FOUND", message: `Strategy ${id} not found` })
          );
        }
        return history;
      }),
  });

export const StrategyServicesLive = Layer.effect(
  StrategyServices,
  Effect.gen(function* () {
    const repo = yield* StrategyRepository;
    return makeStrategyService(repo);
  })
);
