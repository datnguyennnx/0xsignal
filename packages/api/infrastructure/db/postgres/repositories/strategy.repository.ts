import { Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../client";
import type {
  StrategyDefinition,
  StrategyVersion,
  StrategyChangeRecord,
} from "../../../../schemas/strategy";
import { StrategyRepository } from "../../../../application/ports/strategy-repository";
import { DomainError } from "../../../../application/errors";

const dbError = (method: string, cause: unknown) =>
  new DomainError({
    code: "INTERNAL_ERROR",
    message: `Database error in StrategyRepository.${method}`,
    cause,
  });

export const StrategyRepositoryLive = Layer.effect(
  StrategyRepository,
  Effect.gen(function* () {
    const pool = yield* PostgresConnectionPool;

    return {
      insertDefinition: (def: StrategyDefinition) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        INSERT INTO strategy_definitions (id, slug, name, market_type, owner_type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
            const result = await pool.query(sql, [
              def.id,
              def.slug,
              def.name,
              def.market_type,
              def.owner_type,
              def.created_at,
            ]);
            return result.rows[0] as StrategyDefinition;
          },
          catch: (e) => dbError("insertDefinition", e),
        }),

      insertVersion: (version: StrategyVersion) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        INSERT INTO strategy_versions (id, strategy_id, parent_version_id, version, config, change_reason, created_by_action_id, schema_version, trace_id, span_id, correlation_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
            const result = await pool.query(sql, [
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
          catch: (e) => dbError("insertVersion", e),
        }),

      insertChangeRecord: (record: StrategyChangeRecord) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        INSERT INTO strategy_change_records (id, strategy_version_id, change_type, path, previous_value, next_value, summary, trace_id, span_id, correlation_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
            const result = await pool.query(sql, [
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
          catch: (e) => dbError("insertChangeRecord", e),
        }),

      getHistory: (id: string) =>
        Effect.tryPromise({
          try: async () => {
            const defSql = `SELECT * FROM strategy_definitions WHERE id = $1`;
            const defResult = await pool.query(defSql, [id]);
            const def = (defResult.rows[0] as StrategyDefinition | undefined) ?? null;
            if (!def) return null;

            const versionsSql = `SELECT * FROM strategy_versions WHERE strategy_id = $1 ORDER BY version DESC`;
            const versionsResult = await pool.query(versionsSql, [id]);
            const versions = versionsResult.rows as StrategyVersion[];
            const changes: StrategyChangeRecord[] = [];

            for (const v of versions) {
              const changesSql = `SELECT * FROM strategy_change_records WHERE strategy_version_id = $1 ORDER BY created_at`;
              const changesResult = await pool.query(changesSql, [v.id]);
              const vr = changesResult.rows as StrategyChangeRecord[];
              changes.push(...vr);
            }

            return {
              strategy: def,
              versions,
              changes,
            };
          },
          catch: (e) => dbError("getHistory", e),
        }),
    };
  })
);
