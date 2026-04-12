/** Session Routes - /api/sessions */

import type { AgentServices } from "../../../application/agent";

export const makeSessionRoutes = (services: AgentServices) => ({
  createSession: (body: {
    source: string;
    objective: string;
    context_scope?: string;
    actor_kind?: string;
    actor_name?: string;
    source_system?: string;
  }) =>
    services.openSession({
      id: crypto.randomUUID(),
      source: body.source,
      objective: body.objective,
      context_scope: body.context_scope,
      actor_kind: body.actor_kind,
      actor_name: body.actor_name,
      source_system: body.source_system,
    }),

  getSession: (id: string) => services.getSession(id),

  createPlan: (body: {
    session_id: string;
    version: number;
    title: string;
    content_markdown?: string;
    structured_plan?: unknown;
  }) =>
    services.savePlan({
      id: crypto.randomUUID(),
      session_id: body.session_id,
      version: body.version,
      title: body.title,
      content_markdown: body.content_markdown,
      structured_plan: body.structured_plan,
    }),

  recordAction: (body: {
    session_id: string;
    plan_id?: string;
    action_type: "thought" | "action" | "observation" | "planning" | "reasoning";
    target_type?: string;
    target_id?: string;
    input_payload?: unknown;
    result_payload?: unknown;
    status: "pending" | "running" | "completed" | "failed";
    error_code?: string;
    error_message?: string;
  }) =>
    services.recordAction({
      id: crypto.randomUUID(),
      session_id: body.session_id,
      plan_id: body.plan_id,
      action_type: body.action_type,
      target_type: body.target_type,
      target_id: body.target_id,
      input_payload: body.input_payload,
      result_payload: body.result_payload,
      status: body.status,
      error_code: body.error_code,
      error_message: body.error_message,
    }),
});

export type SessionRoutes = ReturnType<typeof makeSessionRoutes>;
