import { Effect } from "effect";

export interface StrategySchemaResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const strategySchemaResource = (): StrategySchemaResource => ({
  uri: `system://strategy-schema`,
  name: "Strategy Schema",
  description: "JSON Schema for strategy definitions and versions",
  mimeType: "application/json",
});

export const getStrategySchema = (): Effect.Effect<{
  resource: StrategySchemaResource;
  content: string;
}> =>
  Effect.succeed({
    resource: strategySchemaResource(),
    content: JSON.stringify(
      {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        definitions: {
          strategy_definition: {
            type: "object",
            required: ["id", "slug", "name", "market_type", "owner_type"],
            properties: {
              id: { type: "string", format: "uuid" },
              slug: { type: "string", pattern: "^[a-z0-9-]+$" },
              name: { type: "string", minLength: 1 },
              market_type: { type: "string", enum: ["crypto", "forex", "equity", "commodity"] },
              owner_type: { type: "string", enum: ["user", "system", "shared"] },
              created_at: { type: "string", format: "date-time" },
            },
          },
          strategy_version: {
            type: "object",
            required: ["id", "strategy_id", "version", "config", "schema_version"],
            properties: {
              id: { type: "string", format: "uuid" },
              strategy_id: { type: "string", format: "uuid" },
              parent_version_id: { type: "string", format: "uuid" },
              version: { type: "integer", minimum: 1 },
              config: { type: "object" },
              change_reason: { type: "string" },
              schema_version: { type: "string" },
              created_at: { type: "string", format: "date-time" },
            },
          },
        },
      },
      null,
      2
    ),
  });
