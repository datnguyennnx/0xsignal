import type {
  StrategyChangeRecord,
  StrategyDefinition,
  StrategyHistory,
  StrategyVersion,
} from "@schemas/strategy";

export interface StrategyRepository {
  insertDefinition(def: StrategyDefinition): Promise<StrategyDefinition>;
  insertVersion(version: StrategyVersion): Promise<StrategyVersion>;
  insertChangeRecord(record: StrategyChangeRecord): Promise<StrategyChangeRecord>;
  getHistory(id: string): Promise<StrategyHistory | null>;
}
