import { Effect } from "effect";
import { getMcpDependencies } from "../../server";

export interface StrategyHistoryResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const strategyHistoryResource = (strategyId: string): StrategyHistoryResource => ({
  uri: `strategy://${strategyId}/history`,
  name: "Strategy History",
  description: `Version chain for strategy ${strategyId}`,
  mimeType: "application/json",
});

export const getStrategyHistory = (strategyId: string) => {
  const deps = getMcpDependencies();
  return deps.strategyServices.getStrategyHistory(strategyId).pipe(
    Effect.map((h) => ({
      resource: strategyHistoryResource(strategyId),
      content: JSON.stringify({
        strategy: {
          id: h.strategy.id,
          slug: h.strategy.slug,
          name: h.strategy.name,
          market_type: h.strategy.market_type,
          owner_type: h.strategy.owner_type,
        },
        versions: h.versions.map((v: any) => ({
          id: v.id,
          version: v.version,
          parent_version_id: v.parent_version_id,
          change_reason: v.change_reason,
          schema_version: v.schema_version,
          created_at: v.created_at,
        })),
        change_count: h.changes.length,
      }),
    }))
  );
};
