/** Strategy Routes - /api/strategies */

import type { StrategyServices } from "../../../application/strategy";
import type { Context } from "effect";

type StrategyService = Context.Tag.Service<typeof StrategyServices>;

export const makeStrategyRoutes = (services: StrategyService) => ({
  createStrategy: (body: {
    slug: string;
    name: string;
    market_type: "crypto" | "forex" | "equity" | "commodity";
    owner_type?: "user" | "system" | "shared";
  }) =>
    services.createStrategyDefinition({
      id: crypto.randomUUID(),
      slug: body.slug,
      name: body.name,
      market_type: body.market_type,
      owner_type: body.owner_type ?? "user",
    }),

  createVersion: (body: {
    strategy_id: string;
    parent_version_id?: string;
    version: number;
    config: unknown;
    change_reason?: string;
    created_by_action_id?: string;
    schema_version?: string;
  }) =>
    services.createStrategyVersion({
      id: crypto.randomUUID(),
      strategy_id: body.strategy_id,
      parent_version_id: body.parent_version_id,
      version: body.version,
      config: body.config,
      change_reason: body.change_reason,
      created_by_action_id: body.created_by_action_id,
      schema_version: body.schema_version ?? "1.0",
    }),

  recordChange: (body: {
    strategy_version_id: string;
    change_type: "create" | "update" | "delete" | "restore";
    path: string;
    previous_value?: unknown;
    next_value?: unknown;
    summary?: string;
  }) =>
    services.recordStrategyChange({
      id: crypto.randomUUID(),
      strategy_version_id: body.strategy_version_id,
      change_type: body.change_type,
      path: body.path,
      previous_value: body.previous_value,
      next_value: body.next_value,
      summary: body.summary,
    }),

  getHistory: (id: string) => services.getStrategyHistory(id),
});

export type StrategyRoutes = ReturnType<typeof makeStrategyRoutes>;
