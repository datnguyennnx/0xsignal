import { query } from "../db/postgres/client";
import type { AgentSession, AgentPlan, AgentAction } from "@schemas/agent";
import type { AgentRepository } from "@application/ports/agent-repository";

export const postgresAgentRepository: AgentRepository = {
  async insertSession(session: AgentSession): Promise<AgentSession> {
    const sql = `
      INSERT INTO agent_sessions (id, source, objective, status, context_scope, actor_kind, actor_name, source_system, trace_id, span_id, correlation_id, request_id, started_at, ended_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const result = await query(sql, [
      session.id,
      session.source,
      session.objective,
      session.status,
      session.context_scope,
      session.actor_kind,
      session.actor_name,
      session.source_system,
      session.trace_id,
      session.span_id,
      session.correlation_id,
      session.request_id,
      session.started_at,
      session.ended_at,
    ]);
    return result.rows[0] as AgentSession;
  },

  async getSession(id: string): Promise<AgentSession | null> {
    const sql = `SELECT * FROM agent_sessions WHERE id = $1`;
    const result = await query(sql, [id]);
    return result.rows[0] as AgentSession | null;
  },

  async insertPlan(plan: AgentPlan): Promise<AgentPlan> {
    const sql = `
      INSERT INTO agent_plans (id, session_id, version, title, content_markdown, structured_plan, trace_id, span_id, correlation_id, request_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await query(sql, [
      plan.id,
      plan.session_id,
      plan.version,
      plan.title,
      plan.content_markdown,
      plan.structured_plan ? JSON.stringify(plan.structured_plan) : null,
      plan.trace_id,
      plan.span_id,
      plan.correlation_id,
      plan.request_id,
      plan.created_at,
    ]);
    return result.rows[0] as AgentPlan;
  },

  async insertAction(action: AgentAction): Promise<AgentAction> {
    const sql = `
      INSERT INTO agent_actions (id, session_id, plan_id, action_type, target_type, target_id, input_payload, result_payload, status, error_code, error_message, trace_id, span_id, correlation_id, request_id, parent_span_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;
    const result = await query(sql, [
      action.id,
      action.session_id,
      action.plan_id,
      action.action_type,
      action.target_type,
      action.target_id,
      action.input_payload ? JSON.stringify(action.input_payload) : null,
      action.result_payload ? JSON.stringify(action.result_payload) : null,
      action.status,
      action.error_code,
      action.error_message,
      action.trace_id,
      action.span_id,
      action.correlation_id,
      action.request_id,
      action.parent_span_id,
      action.created_at,
    ]);
    return result.rows[0] as AgentAction;
  },
};
