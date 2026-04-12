import { Effect } from "effect";
import { getMcpDependencies } from "../server";

export const createStrategyVersionTool = {
  name: "create_strategy_version",
  description: "Create a new version of a strategy with frozen configuration",
  inputSchema: {
    type: "object",
    properties: {
      strategy_id: { type: "string" },
      parent_version_id: { type: "string" },
      version: { type: "integer" },
      config: { type: "object" },
      change_reason: { type: "string" },
      created_by_action_id: { type: "string" },
      schema_version: { type: "string" },
    },
    required: ["strategy_id", "version", "config"],
  },
  execute: (input: {
    strategy_id: string;
    parent_version_id?: string;
    version: number;
    config: unknown;
    change_reason?: string;
    created_by_action_id?: string;
    schema_version?: string;
  }) => {
    const deps = getMcpDependencies();
    return deps.strategyServices
      .createStrategyVersion({
        id: crypto.randomUUID(),
        strategy_id: input.strategy_id,
        parent_version_id: input.parent_version_id,
        version: input.version,
        config: input.config,
        change_reason: input.change_reason,
        created_by_action_id: input.created_by_action_id,
        schema_version: input.schema_version ?? "1.0",
      })
      .pipe(Effect.map((version) => ({ version_id: version.id, version: version.version })));
  },
};
