import { query } from "../db/postgres/client";
import type {
  StrategyDefinition,
  StrategyVersion,
  StrategyChangeRecord,
  StrategyHistory,
} from "@schemas/strategy";
import type { StrategyRepository } from "@application/ports/strategy-repository";

export const postgresStrategyRepository: StrategyRepository = {
  async insertDefinition(def: StrategyDefinition): Promise<StrategyDefinition> {
    const sql = `
      INSERT INTO strategy_definitions (id, slug, name, market_type, owner_type, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await query(sql, [
      def.id,
      def.slug,
      def.name,
      def.market_type,
      def.owner_type,
      def.created_at,
    ]);
    return result.rows[0] as StrategyDefinition;
  },

  async getDefinition(id: string): Promise<StrategyDefinition | null> {
    const sql = `SELECT * FROM strategy_definitions WHERE id = $1`;
    const result = await query(sql, [id]);
    return result.rows[0] as StrategyDefinition | null;
  },

  async insertVersion(version: StrategyVersion): Promise<StrategyVersion> {
    const sql = `
      INSERT INTO strategy_versions (id, strategy_id, parent_version_id, version, config, change_reason, created_by_action_id, schema_version, trace_id, span_id, correlation_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const result = await query(sql, [
      version.id,
      version.strategy_id,
      version.parent_version_id,
      version.version,
      typeof version.config === "string" ? version.config : JSON.stringify(version.config),
      version.change_reason,
      version.created_by_action_id,
      version.schema_version,
      version.trace_id,
      version.span_id,
      version.correlation_id,
      version.created_at,
    ]);
    return result.rows[0] as StrategyVersion;
  },

  async getVersion(id: string): Promise<StrategyVersion | null> {
    const sql = `SELECT * FROM strategy_versions WHERE id = $1`;
    const result = await query(sql, [id]);
    return result.rows[0] as StrategyVersion | null;
  },

  async getVersionsByStrategy(strategyId: string): Promise<StrategyVersion[]> {
    const sql = `SELECT * FROM strategy_versions WHERE strategy_id = $1 ORDER BY version DESC`;
    const result = await query(sql, [strategyId]);
    return result.rows as StrategyVersion[];
  },

  async insertChangeRecord(record: StrategyChangeRecord): Promise<StrategyChangeRecord> {
    const sql = `
      INSERT INTO strategy_change_records (id, strategy_version_id, change_type, path, previous_value, next_value, summary, trace_id, span_id, correlation_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await query(sql, [
      record.id,
      record.strategy_version_id,
      record.change_type,
      record.path,
      record.previous_value
        ? typeof record.previous_value === "string"
          ? record.previous_value
          : JSON.stringify(record.previous_value)
        : null,
      record.next_value
        ? typeof record.next_value === "string"
          ? record.next_value
          : JSON.stringify(record.next_value)
        : null,
      record.summary,
      record.trace_id,
      record.span_id,
      record.correlation_id,
      record.created_at,
    ]);
    return result.rows[0] as StrategyChangeRecord;
  },

  async getChangeRecordsByVersion(versionId: string): Promise<StrategyChangeRecord[]> {
    const sql = `SELECT * FROM strategy_change_records WHERE strategy_version_id = $1 ORDER BY created_at`;
    const result = await query(sql, [versionId]);
    return result.rows as StrategyChangeRecord[];
  },

  async getHistory(id: string): Promise<StrategyHistory | null> {
    const def = await this.getDefinition(id);
    if (!def) return null;

    const versions = await this.getVersionsByStrategy(id);
    const changes: StrategyChangeRecord[] = [];

    for (const v of versions) {
      const vr = await this.getChangeRecordsByVersion(v.id);
      changes.push(...vr);
    }

    return {
      strategy: def,
      versions,
      changes,
    };
  },
};
