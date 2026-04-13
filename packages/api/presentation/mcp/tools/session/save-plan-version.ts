import { Effect } from "effect";
import { getMcpDependencies } from "../../server";

export const savePlanVersionTool = {
  name: "save_plan_version",
  description: "Save a plan version within a session",
  inputSchema: {
    type: "object",
    properties: {
      session_id: { type: "string" },
      version: { type: "integer" },
      title: { type: "string" },
      content_markdown: { type: "string" },
      structured_plan: { type: "object" },
    },
    required: ["session_id", "version", "title"],
  },
  execute: (input: {
    session_id: string;
    version: number;
    title: string;
    content_markdown?: string;
    structured_plan?: unknown;
  }) => {
    const deps = getMcpDependencies();
    return deps.agentServices
      .savePlan({
        id: crypto.randomUUID(),
        session_id: input.session_id,
        version: input.version,
        title: input.title,
        content_markdown: input.content_markdown,
        structured_plan: input.structured_plan,
      })
      .pipe(Effect.map((plan) => ({ plan_id: plan.id, version: plan.version })));
  },
};
