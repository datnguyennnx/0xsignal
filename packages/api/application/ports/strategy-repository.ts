import { Context, Effect } from "effect";
import type {
  StrategyChangeRecord,
  StrategyDefinition,
  StrategyHistory,
  StrategyVersion,
} from "../../schemas/strategy";
import { DomainError } from "../errors";

export interface StrategyRepository {
  readonly insertDefinition: (
    def: StrategyDefinition
  ) => Effect.Effect<StrategyDefinition, DomainError>;
  readonly insertVersion: (version: StrategyVersion) => Effect.Effect<StrategyVersion, DomainError>;
  readonly insertChangeRecord: (
    record: StrategyChangeRecord
  ) => Effect.Effect<StrategyChangeRecord, DomainError>;
  readonly getHistory: (id: string) => Effect.Effect<StrategyHistory | null, DomainError>;
}

export const StrategyRepository = Context.GenericTag<StrategyRepository>(
  "@services/StrategyRepository"
);
