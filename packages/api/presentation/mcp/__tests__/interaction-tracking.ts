import type { MCPInteraction } from "../../../domain/types";

export interface MCPDependencies {
  agentServices: any;
  strategyServices: any;
  backtestServices: any;
  researchServices: any;
  marketDataServices: any;
  mcpRepository: {
    insertInteraction: (interaction: MCPInteraction) => Promise<MCPInteraction>;
    updateInteractionStatus: (
      id: string,
      status: string,
      outputPayload?: string | unknown
    ) => Promise<MCPInteraction | null>;
  };
}

const mcpRepository = {
  insertInteraction: async (interaction: MCPInteraction) => {
    const { query } = await import("../../../infrastructure/db/postgres/client");
    const sql = `
      INSERT INTO mcp_interactions (id, session_id, interaction_type, name, input_payload, output_payload, status, trace_id, span_id, correlation_id, request_id, parent_span_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const result = await query(sql, [
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
  updateInteractionStatus: async (id: string, status: string, outputPayload?: string | unknown) => {
    const { query } = await import("../../../infrastructure/db/postgres/client");
    const sql = `
      UPDATE mcp_interactions
      SET status = $2, output_payload = $3
      WHERE id = $1
      RETURNING *
    `;
    const result = await query(sql, [
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
};

export async function trackMCPInteraction(params: {
  name: string;
  type: string;
  sessionId?: string;
  input: unknown;
  traceId?: string;
  spanId?: string;
  correlationId?: string;
  requestId?: string;
  parentSpanId?: string;
}): Promise<{
  trackInteraction: (output: unknown, status: string) => Promise<void>;
  interaction: MCPInteraction;
}> {
  const interaction: MCPInteraction = {
    id: crypto.randomUUID(),
    session_id: params.sessionId,
    interaction_type: params.type,
    name: params.name,
    input_payload: params.input,
    status: "running",
    trace_id: params.traceId,
    span_id: params.spanId,
    correlation_id: params.correlationId,
    request_id: params.requestId,
    parent_span_id: params.parentSpanId,
    created_at: new Date().toISOString(),
  };

  await mcpRepository.insertInteraction(interaction);

  return {
    interaction,
    async trackInteraction(output: unknown, status: string) {
      await mcpRepository.updateInteractionStatus(interaction.id, status, output);
    },
  };
}

export const mcpInteractionTracking = {
  async trackToolExecution(params: {
    name: string;
    type: string;
    sessionId?: string;
    input: unknown;
    traceId?: string;
    spanId?: string;
    correlationId?: string;
    requestId?: string;
    parentSpanId?: string;
  }) {
    return trackMCPInteraction(params);
  },
};
