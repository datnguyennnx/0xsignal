import { openSessionTool } from "./tools/session/open-session";
import { savePlanVersionTool } from "./tools/session/save-plan-version";
import { recordAgentActionTool } from "./tools/session/record-agent-action";
import { createStrategyDefinitionTool } from "./tools/strategy/create-strategy-definition";
import { createStrategyVersionTool } from "./tools/strategy/create-strategy-version";
import { createCandlestickRequestTool } from "./tools/market-data/create-candlestick-request";
import { createDatasetSnapshotTool } from "./tools/market-data/create-dataset-snapshot";
import { startBacktestRunTool } from "./tools/backtest/start-backtest-run";
import { appendResearchNoteTool } from "./tools/research/append-research-note";
import { createArtifactTool } from "./tools/research/create-artifact";
import { getRunSummaryTool } from "./tools/backtest/get-run-summary";
import { discoverMarketsTool } from "./tools/market-data/discover-markets";
import { getCandlesTool } from "./tools/market-data/get-candles";
import { inspectCandleCoverageTool } from "./tools/market-data/inspect-candle-coverage";
import { ensureCandleCoverageTool } from "./tools/market-data/ensure-candle-coverage";

export const ALL_TOOLS = [
  openSessionTool,
  savePlanVersionTool,
  recordAgentActionTool,
  createStrategyDefinitionTool,
  createStrategyVersionTool,
  createCandlestickRequestTool,
  createDatasetSnapshotTool,
  startBacktestRunTool,
  appendResearchNoteTool,
  createArtifactTool,
  getRunSummaryTool,
  discoverMarketsTool,
  getCandlesTool,
  inspectCandleCoverageTool,
  ensureCandleCoverageTool,
];
