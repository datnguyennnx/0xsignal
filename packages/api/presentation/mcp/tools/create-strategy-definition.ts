import { Effect } from "effect";
import { getMcpDependencies } from "../server";

export const createStrategyDefinitionTool = {
  name: "create_strategy_definition",
  description: "Create a new strategy definition with a unique slug",
  inputSchema: {
    type: "object",
    properties: {
      slug: { type: "string" },
      name: { type: "string" },
      market_type: { type: "string", enum: ["crypto", "forex", "equity", "commodity"] },
      owner_type: { type: "string", enum: ["user", "system", "shared"] },
    },
    required: ["slug", "name", "market_type"],
  },
  execute: (input: {
    slug: string;
    name: string;
    market_type: "crypto" | "forex" | "equity" | "commodity";
    owner_type?: "user" | "system" | "shared";
  }) => {
    const deps = getMcpDependencies();
    return deps.strategyServices
      .createStrategyDefinition({
        id: crypto.randomUUID(),
        slug: input.slug,
        name: input.name,
        market_type: input.market_type,
        owner_type: input.owner_type ?? "user",
      })
      .pipe(Effect.map((strategy) => ({ strategy_id: strategy.id, slug: strategy.slug })));
  },
};
