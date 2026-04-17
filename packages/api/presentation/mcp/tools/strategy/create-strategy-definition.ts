import { Effect } from "effect";
import { StrategyServices } from "@application/strategy";
import { DomainError } from "@application/errors";

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
  }) =>
    Effect.gen(function* () {
      const services = yield* StrategyServices;
      return yield* services
        .createStrategyDefinition({
          id: crypto.randomUUID(),
          slug: input.slug,
          name: input.name,
          market_type: input.market_type,
          owner_type: input.owner_type ?? "user",
        })
        .pipe(
          Effect.map((strategy) => ({ strategy_id: strategy.id, slug: strategy.slug })),
          Effect.catchAll((error) => {
            if (error instanceof DomainError && error.code === "ALREADY_EXISTS") {
              return Effect.succeed({
                error: "SLUG_ALREADY_EXISTS",
                message: error.message,
                slug: input.slug,
              });
            }

            return Effect.fail(error);
          })
        );
    }),
};
