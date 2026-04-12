import { openSessionTool } from "./tools/open-session";
import { savePlanVersionTool } from "./tools/save-plan-version";
import { recordAgentActionTool } from "./tools/record-agent-action";
import { createStrategyDefinitionTool } from "./tools/create-strategy-definition";
import { createStrategyVersionTool } from "./tools/create-strategy-version";
import { createCandlestickRequestTool } from "./tools/create-candlestick-request";
import { createDatasetSnapshotTool } from "./tools/create-dataset-snapshot";
import { startBacktestRunTool } from "./tools/start-backtest-run";
import { appendResearchNoteTool } from "./tools/append-research-note";
import { createArtifactTool } from "./tools/create-artifact";
import { getRunSummaryTool } from "./tools/get-run-summary";
import { discoverMarketsTool } from "./tools/discover-markets";
import { getCandlesTool } from "./tools/get-candles";
import { inspectCandleCoverageTool } from "./tools/inspect-candle-coverage";
import { explainDataSourcePolicyTool } from "./tools/explain-data-source-policy";
import { ensureCandleCoverageTool } from "./tools/ensure-candle-coverage";

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
  explainDataSourcePolicyTool,
  ensureCandleCoverageTool,
];

export const findTool = (name: string) => ALL_TOOLS.find((t) => t.name === name);
