import { AgentServices, AgentServicesLayer } from "@application/agent";
import { StrategyServices, makeStrategyService } from "@application/strategy";
import { BacktestServices, BacktestServicesLayer } from "@application/backtest";
import type { ResearchServices } from "@application/research";
import { MarketDataServices, MarketDataServicesLayer } from "@application/market-data";
import { makeResearchService } from "@application/research";
import { postgresAgentRepository } from "@infrastructure/repositories/agent-repo";
import { postgresStrategyRepository } from "@infrastructure/repositories/strategy-repo";
import { postgresBacktestRepository } from "@infrastructure/repositories/backtest-repo";
import { postgresResearchRepository } from "@infrastructure/repositories/research-repo";
import { postgresMarketDataRepository } from "@infrastructure/repositories/market-data-repo";
import { postgresMCPRepository } from "@infrastructure/repositories/mcp-repo";

import { CandleRepositoryLayer } from "@infrastructure/db/questdb/repositories/candle";
import { HyperliquidProviderLayer } from "@infrastructure/data-sources/hyperliquid/providers";
import { QuestDBClientLayer } from "@infrastructure/db/questdb/client";
import { HyperliquidClientLive } from "@infrastructure/data-sources/hyperliquid/client";
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

let dependencies: McpServerDependencies | null = null;

export const initializeMcpServer = (
  config?: Partial<McpServerConfig>,
  deps?: McpServerDependencies
): McpServerState => {
  serverState = {
    ...serverState,
    config: { ...serverState.config, ...config },
    initialized: true,
  };
  dependencies = deps ?? null;
  return serverState;
};

export const shutdownMcpServer = async (): Promise<void> => {
  serverState = { ...serverState, initialized: false };
};

export const getMcpServerState = (): McpServerState => serverState;

export const getMcpDependencies = (): McpServerDependencies => {
  if (!dependencies) {
    throw new Error("MCP server not initialized with dependencies");
  }
  return dependencies;
};

/**
 * Creates the base Effect Layer for all top-level services
 */
export const McpContextLayer = Layer.mergeAll(
  MarketDataServicesLayer(postgresMarketDataRepository).pipe(
    Layer.provide(CandleRepositoryLayer),
    Layer.provide(HyperliquidProviderLayer),
    Layer.provide(QuestDBClientLayer),
    Layer.provide(HyperliquidClientLive)
  ),
  BacktestServicesLayer(postgresBacktestRepository).pipe(Layer.provide(StubEngineExecutor)),
  AgentServicesLayer(postgresAgentRepository)
);

// We keep these for legacy compatibility with the Stdio server handlers that are NOT fully Effectful yet
export const makeMcpDependencies = async (): Promise<McpServerDependencies> => {
  // We run the effects to resolve the services from the Layer stack
  const services = await Effect.runPromise(
    Effect.gen(function* () {
      const marketDataServices = yield* MarketDataServices;
      const backtestServices = yield* BacktestServices;
      const agentServices = yield* AgentServices;

      return {
        marketDataServices,
        backtestServices,
        agentServices,
        strategyServices: makeStrategyService(postgresStrategyRepository),
        researchServices: makeResearchService(postgresResearchRepository),
        mcpRepository: postgresMCPRepository,
      };
    }).pipe(Effect.provide(McpContextLayer))
  );

  return services;
};
