import { Layer } from "effect";
import { AgentRepositoryLive } from "../db/postgres/repositories/agent.repository";
import { BacktestRepositoryLive } from "../db/postgres/repositories/backtest.repository";
import { MarketDataRepositoryLive } from "../db/postgres/repositories/market-data.repository";
import { MCPRepositoryLive } from "../db/postgres/repositories/mcp.repository";
import { ResearchRepositoryLive } from "../db/postgres/repositories/research.repository";
import { StrategyRepositoryLive } from "../db/postgres/repositories/strategy.repository";

export const RepositoriesLive = Layer.mergeAll(
  AgentRepositoryLive,
  BacktestRepositoryLive,
  MarketDataRepositoryLive,
  MCPRepositoryLive,
  ResearchRepositoryLive,
  StrategyRepositoryLive
);
