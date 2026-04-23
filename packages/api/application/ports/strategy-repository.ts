import { Context } from "effect";
import type {
  StrategyChangeRecord,
  StrategyDefinition,
  StrategyHistory,
  StrategyVersion,
} from "../../schemas/strategy";

export interface StrategyRepository {
  readonly insertDefinition: (def: StrategyDefinition) => Promise<StrategyDefinition>;
  readonly insertVersion: (version: StrategyVersion) => Promise<StrategyVersion>;
  readonly insertChangeRecord: (record: StrategyChangeRecord) => Promise<StrategyChangeRecord>;
  readonly getHistory: (id: string) => Promise<StrategyHistory | null>;
}

export const StrategyRepository = Context.GenericTag<StrategyRepository>(
  "@services/StrategyRepository"
);
