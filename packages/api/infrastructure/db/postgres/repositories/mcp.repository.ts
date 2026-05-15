import { Effect, Layer } from "effect";
import { PostgresConnectionPool } from "../client";
import type { McpInteraction as MCPInteraction } from "../../../../schemas/mcp";
import { MCPRepository } from "../../../../application/ports/mcp-repository";
import { DomainError } from "../../../../application/errors";

const dbError = (method: string, cause: unknown) =>
  new DomainError({
    code: "INTERNAL_ERROR",
    message: `Database error in MCPRepository.${method}`,
    cause,
  });

export const MCPRepositoryLive = Layer.effect(
  MCPRepository,
  Effect.gen(function* () {
    const pool = yield* PostgresConnectionPool;

    return {
      insertInteraction: (interaction: MCPInteraction) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        INSERT INTO mcp_interactions (id, session_id, interaction_type, name, input_payload, output_payload, status, trace_id, span_id, correlation_id, request_id, parent_span_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
            const result = await pool.query(sql, [
              interaction.id,
              interaction.session_id,
              interaction.interaction_type,
              interaction.name,
              interaction.input_payload
                ? typeof interaction.input_payload === "string"
                  ? interaction.input_payload
                  : JSON.stringify(interaction.input_payload)
                : null,
              interaction.output_payload
                ? typeof interaction.output_payload === "string"
                  ? interaction.output_payload
                  : JSON.stringify(interaction.output_payload)
                : null,
              interaction.status,
              interaction.trace_id,
              interaction.span_id,
              interaction.correlation_id,
              interaction.request_id,
              interaction.parent_span_id,
              interaction.created_at,
            ]);
            return result.rows[0] as MCPInteraction;
          },
          catch: (e) => dbError("insertInteraction", e),
        }),

      getInteraction: (id: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT * FROM mcp_interactions WHERE id = $1`;
            const result = await pool.query(sql, [id]);
            return result.rows[0] as MCPInteraction | null;
          },
          catch: (e) => dbError("getInteraction", e),
        }),

      getInteractionsBySession: (sessionId: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT * FROM mcp_interactions WHERE session_id = $1 ORDER BY created_at`;
            const result = await pool.query(sql, [sessionId]);
            return result.rows as MCPInteraction[];
          },
          catch: (e) => dbError("getInteractionsBySession", e),
        }),

      getInteractionsByCorrelation: (correlationId: string) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `SELECT * FROM mcp_interactions WHERE correlation_id = $1 ORDER BY created_at`;
            const result = await pool.query(sql, [correlationId]);
            return result.rows as MCPInteraction[];
          },
          catch: (e) => dbError("getInteractionsByCorrelation", e),
        }),

      updateInteractionStatus: (id: string, status: string, outputPayload?: string | unknown) =>
        Effect.tryPromise({
          try: async () => {
            const sql = `
        UPDATE mcp_interactions
        SET status = $2, output_payload = $3
        WHERE id = $1
        RETURNING *
      `;
            const result = await pool.query(sql, [
              id,
              status,
              outputPayload
                ? typeof outputPayload === "string"
                  ? outputPayload
                  : JSON.stringify(outputPayload)
                : null,
            ]);
            return result.rows[0] as MCPInteraction | null;
          },
          catch: (e) => dbError("updateInteractionStatus", e),
        }),
    };
  })
);
