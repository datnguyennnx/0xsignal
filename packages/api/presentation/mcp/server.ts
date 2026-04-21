import { AgentServices, AgentServicesLayer } from "@application/agent";
import { StrategyServices, StrategyServicesLayer } from "@application/strategy";
import { BacktestServices, BacktestServicesLayer } from "@application/backtest";
import { ResearchServicesTag, ResearchServicesLayer } from "@application/research";
import type { ResearchServices } from "@application/research";
import { MarketDataServices } from "@application/market-data";
import { EngineExecutor } from "@domain/backtest/engine";
import { postgresAgentRepository } from "@infrastructure/repositories/agent-repo";
import { postgresStrategyRepository } from "@infrastructure/repositories/strategy-repo";
import { postgresBacktestRepository } from "@infrastructure/repositories/backtest-repo";
import { postgresResearchRepository } from "@infrastructure/repositories/research-repo";
import { postgresMCPRepository } from "@infrastructure/repositories/mcp-repo";
import { makeMarketDataLayer } from "@infrastructure/layers/market-data.layer";
import { StubEngineExecutor } from "@infrastructure/workers/engine.stub";
import { Effect, Layer, Context } from "effect";

export interface McpServerConfig {
  serverName: string;
  serverVersion: string;
}

import type { MCPRepository } from "@infrastructure/repositories/mcp-repo";

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

export const defaultCapabilities = {
  resources: {
    system_architecture: true,
    system_strategy_schema: true,
    session_context: true,
    strategy_history: true,
    run_summary: true,
  },
  tools: {
    open_session: true,
    save_plan_version: true,
    record_agent_action: true,
    create_strategy_definition: true,
    create_strategy_version: true,
    create_candlestick_request: true,
    create_dataset_snapshot: true,
    start_backtest_run: true,
    append_research_note: true,
    create_artifact: true,
    get_run_summary: true,
    discover_markets: true,
    get_candles: true,
    inspect_candle_coverage: true,
    ensure_candle_coverage: true,
  },
};

export interface McpServerState {
  initialized: boolean;
  capabilities: typeof defaultCapabilities;
  config: McpServerConfig;
}

let serverState: McpServerState = {
  initialized: false,
  capabilities: defaultCapabilities,
  config: {
    serverName: "0xsignal-mcp",
    serverVersion: "1.0.0",
  },
};

export const initializeMcpServer = (config?: Partial<McpServerConfig>): McpServerState => {
  serverState = {
    ...serverState,
    config: { ...serverState.config, ...config },
    initialized: true,
  };
  return serverState;
};

export const shutdownMcpServer = async (): Promise<void> => {
  serverState = { ...serverState, initialized: false };
};

export const getMcpServerState = (): McpServerState => serverState;

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

// We keep these for legacy compatibility with the Stdio server handlers that are NOT fully Effectful yet
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
