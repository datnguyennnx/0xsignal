import type {
  StrategyChangeRecord,
  StrategyDefinition,
  StrategyHistory,
  StrategyVersion,
} from "@schemas/strategy";

export interface StrategyRepository {
  insertDefinition(def: StrategyDefinition): Promise<StrategyDefinition>;
  getDefinition(id: string): Promise<StrategyDefinition | null>;
  insertVersion(version: StrategyVersion): Promise<StrategyVersion>;
  getVersion(id: string): Promise<StrategyVersion | null>;
  getVersionsByStrategy(strategyId: string): Promise<StrategyVersion[]>;
  insertChangeRecord(record: StrategyChangeRecord): Promise<StrategyChangeRecord>;
  getChangeRecordsByVersion(versionId: string): Promise<StrategyChangeRecord[]>;
  getHistory(id: string): Promise<StrategyHistory | null>;
}
