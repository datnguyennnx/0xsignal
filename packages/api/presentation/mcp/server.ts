import { Effect, ManagedRuntime, Context, Layer } from "effect";
import { AppLayer } from "../../infrastructure/layers/app.layer";
import { AgentServices } from "../../application/agent/service";
import { StrategyServices } from "../../application/strategy/service";
import { BacktestServices } from "../../application/backtest/service";
import { ResearchServicesTag } from "../../application/research/service";
import { MarketDataServices } from "../../application/market-data/contracts";
import { MCPRepository } from "../../application/ports/mcp-repository";
import { McpServicesLive } from "../../application/mcp/service";

/**
 * MCP Runtime - bridge between Effect-TS application services and MCP protocol handlers.
 * Standardizes on AppLayer for all capability resolution.
 */
export const McpRuntime = ManagedRuntime.make(AppLayer);

export interface McpServerDependencies {
  readonly agentServices: Context.Tag.Service<typeof AgentServices>;
  readonly strategyServices: Context.Tag.Service<typeof StrategyServices>;
  readonly backtestServices: Context.Tag.Service<typeof BacktestServices>;
  readonly researchServices: Context.Tag.Service<typeof ResearchServicesTag>;
  readonly marketDataServices: Context.Tag.Service<typeof MarketDataServices>;
  readonly mcpRepository: MCPRepository;
}

export const runMcpEffect = <A, E>(effect: Effect.Effect<A, E, any>) =>
  McpRuntime.runPromise(effect);

export const createRuntimeFromDeps = (deps: McpServerDependencies) => {
  const layer = Layer.mergeAll(
    Layer.succeed(AgentServices, deps.agentServices),
    Layer.succeed(StrategyServices, deps.strategyServices),
    Layer.succeed(BacktestServices, deps.backtestServices),
    Layer.succeed(ResearchServicesTag, deps.researchServices),
    Layer.succeed(MarketDataServices, deps.marketDataServices),
    Layer.provide(McpServicesLive, Layer.succeed(MCPRepository, deps.mcpRepository))
  );
  return ManagedRuntime.make(layer);
};
