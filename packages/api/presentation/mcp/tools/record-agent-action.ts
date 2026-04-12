import { Effect } from "effect";
import { getMcpDependencies } from "../server";

export const recordAgentActionTool = {
  name: "record_agent_action",
  description: "Record an agent action with input/output payloads",
  inputSchema: {
    type: "object",
    properties: {
      session_id: { type: "string" },
      plan_id: { type: "string" },
      action_type: {
        type: "string",
        enum: ["thought", "action", "observation", "planning", "reasoning"],
      },
      target_type: { type: "string" },
      target_id: { type: "string" },
      input_payload: { type: "object" },
      result_payload: { type: "object" },
      status: { type: "string", enum: ["pending", "running", "completed", "failed"] },
      error_code: { type: "string" },
      error_message: { type: "string" },
    },
    required: ["session_id", "action_type", "status"],
  },
  execute: (input: {
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
  }) => {
    const deps = getMcpDependencies();
    return deps.agentServices
      .recordAction({
        id: crypto.randomUUID(),
        session_id: input.session_id,
        plan_id: input.plan_id,
        action_type: input.action_type,
        target_type: input.target_type,
        target_id: input.target_id,
        input_payload: input.input_payload,
        result_payload: input.result_payload,
        status: input.status,
        error_code: input.error_code,
        error_message: input.error_message,
      })
      .pipe(Effect.map((action) => ({ action_id: action.id, status: action.status })));
  },
};
