import { Layer } from "effect";
import { AgentServicesLive } from "../../application/agent/service";
import { StrategyServicesLive } from "../../application/strategy/service";
import { BacktestServicesLive } from "../../application/backtest/service";
import { ResearchServicesLive } from "../../application/research/service";
import { MarketDataServicesLive } from "../../application/market-data/service";
import { McpServicesLive } from "../../application/mcp/service";

export const AppServicesLive = Layer.mergeAll(
  AgentServicesLive,
  StrategyServicesLive,
  BacktestServicesLive,
  ResearchServicesLive,
  MarketDataServicesLive,
  McpServicesLive
);
