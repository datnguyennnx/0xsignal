import { Effect } from "effect";
import { getMcpDependencies } from "../server";

export const openSessionTool = {
  name: "open_session",
  description: "Open a new agent session for tracking objectives and actions",
  execute: (input: {
    source: string;
    objective: string;
    context_scope?: string;
    actor_kind?: string;
    actor_name?: string;
    source_system?: string;
  }) => {
    const deps = getMcpDependencies();
    return deps.agentServices
      .openSession({
        id: crypto.randomUUID(),
        source: input.source,
        objective: input.objective,
        context_scope: input.context_scope,
        actor_kind: input.actor_kind,
        actor_name: input.actor_name,
        source_system: input.source_system,
      })
      .pipe(
        Effect.map((session) => ({
          session_id: session.id,
          status: session.status,
        }))
      );
  },
  inputSchema: {
    type: "object",
    properties: {
      source: { type: "string" },
      objective: { type: "string" },
      context_scope: { type: "string" },
      actor_kind: { type: "string" },
      actor_name: { type: "string" },
      source_system: { type: "string" },
    },
    required: ["source", "objective"],
  },
};
