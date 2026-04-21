import { AgentServices, AgentServicesLayer } from "../../application/agent/service";
import { StrategyServices, StrategyServicesLayer } from "../../application/strategy/service";
import { BacktestServices, BacktestServicesLayer } from "../../application/backtest/service";
import { ResearchServicesTag, ResearchServicesLayer } from "../../application/research/service";
import type { ResearchServices } from "../../application/research/service";
import { MarketDataServices } from "../../application/market-data/contracts";
import { EngineExecutor } from "../../domain/backtest/engine";
import { postgresAgentRepository } from "../../infrastructure/db/postgres/repositories/agent.repository";
import { postgresStrategyRepository } from "../../infrastructure/db/postgres/repositories/strategy.repository";
import { postgresBacktestRepository } from "../../infrastructure/db/postgres/repositories/backtest.repository";
import { postgresResearchRepository } from "../../infrastructure/db/postgres/repositories/research.repository";
import { postgresMCPRepository } from "../../infrastructure/db/postgres/repositories/mcp.repository";
import { makeMarketDataLayer } from "../../infrastructure/layers/market-data.layer";
import { StubEngineExecutor } from "../../infrastructure/workers/engine.stub";
import { Effect, Layer, Context } from "effect";

import type { MCPRepository } from "../../infrastructure/db/postgres/repositories/mcp.repository";

export interface McpServerDependencies {
  agentServices: Context.Tag.Service<typeof AgentServices>;
  strategyServices: Context.Tag.Service<typeof StrategyServices>;
  backtestServices: Context.Tag.Service<typeof BacktestServices>;
  researchServices: ResearchServices;
  marketDataServices: Context.Tag.Service<typeof MarketDataServices>;
  mcpRepository: MCPRepository;
}

export const makeMcpRequestLayer = (deps: McpServerDependencies) =>
  Layer.mergeAll(
    Layer.succeed(AgentServices, deps.agentServices),
    Layer.succeed(BacktestServices, deps.backtestServices),
    Layer.succeed(MarketDataServices, deps.marketDataServices),
    Layer.succeed(StrategyServices, deps.strategyServices),
    Layer.succeed(ResearchServicesTag, deps.researchServices)
  );

type McpExecutionLayerConfig = {
  readonly backtestEngineLayer?: Layer.Layer<EngineExecutor>;
};

export const makeMcpExecutionLayer = (config: McpExecutionLayerConfig = {}) => {
  const backtestLayer = BacktestServicesLayer(postgresBacktestRepository).pipe(
    Layer.provide(config.backtestEngineLayer ?? StubEngineExecutor)
  );

  return Layer.mergeAll(
    makeMarketDataLayer(),
    backtestLayer,
    AgentServicesLayer(postgresAgentRepository),
    StrategyServicesLayer(postgresStrategyRepository),
    ResearchServicesLayer(postgresResearchRepository)
  );
};

// Stdio entrypoints still resolve services eagerly; they consume this Promise-based bootstrap until migrated to Layer.provide.
export const makeMcpDependencies = async (
  options: McpExecutionLayerConfig = {}
): Promise<McpServerDependencies> => {
  // We run the effects to resolve the services from the Layer stack
  const services = await Effect.runPromise(
    Effect.gen(function* () {
      const marketDataServices = yield* MarketDataServices;
      const backtestServices = yield* BacktestServices;
      const agentServices = yield* AgentServices;
      const strategyServices = yield* StrategyServices;
      const researchServices = yield* ResearchServicesTag;

      return {
        marketDataServices,
        backtestServices,
        agentServices,
        strategyServices,
        researchServices,
        mcpRepository: postgresMCPRepository,
      };
    }).pipe(Effect.provide(makeMcpExecutionLayer(options)))
  );

  return services;
};
