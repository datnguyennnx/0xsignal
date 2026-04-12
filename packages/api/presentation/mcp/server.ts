import type { AgentServices } from "../../application/agent";
import type { StrategyServices } from "../../application/strategy";
import type { BacktestServices } from "../../application/backtest";
import type { ResearchServices } from "../../application/research";
import type { MarketDataServices } from "../../application/market-data";
import { makeAgentService } from "../../application/agent";
import { makeStrategyService } from "../../application/strategy";
import { makeBacktestService } from "../../application/backtest";
import { makeResearchService } from "../../application/research";
import { makeMarketDataService } from "../../application/market-data";
import { postgresAgentRepository } from "../../infrastructure/repositories/agent-repo";
import { postgresStrategyRepository } from "../../infrastructure/repositories/strategy-repo";
import { postgresBacktestRepository } from "../../infrastructure/repositories/backtest-repo";
import { postgresResearchRepository } from "../../infrastructure/repositories/research-repo";
import { postgresMarketDataRepository } from "../../infrastructure/repositories/market-data-repo";
import { postgresMCPRepository } from "../../infrastructure/repositories/mcp-repo";

export interface McpServerConfig {
  serverName: string;
  serverVersion: string;
}

import type { MCPRepository } from "../../infrastructure/repositories/mcp-repo";

export interface McpServerDependencies {
  agentServices: AgentServices;
  strategyServices: StrategyServices;
  backtestServices: BacktestServices;
  researchServices: ResearchServices;
  marketDataServices: MarketDataServices;
  mcpRepository: MCPRepository;
}

export const makeMcpDependencies = (): McpServerDependencies => ({
  agentServices: makeAgentService(postgresAgentRepository),
  strategyServices: makeStrategyService(postgresStrategyRepository),
  backtestServices: makeBacktestService(postgresBacktestRepository),
  researchServices: makeResearchService(postgresResearchRepository),
  marketDataServices: makeMarketDataService(postgresMarketDataRepository),
  mcpRepository: postgresMCPRepository,
});

export interface McpCapabilities {
  resources: {
    system_architecture: boolean;
    system_strategy_schema: boolean;
    session_context: boolean;
    strategy_history: boolean;
    run_summary: boolean;
  };
  tools: {
    open_session: boolean;
    save_plan_version: boolean;
    record_agent_action: boolean;
    create_strategy_definition: boolean;
    create_strategy_version: boolean;
    create_candlestick_request: boolean;
    create_dataset_snapshot: boolean;
    start_backtest_run: boolean;
    append_research_note: boolean;
    get_run_summary: boolean;
  };
}

export const defaultCapabilities: McpCapabilities = {
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
    get_run_summary: true,
  },
};

export interface McpServerState {
  initialized: boolean;
  capabilities: McpCapabilities;
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
