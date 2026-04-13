import { it, expect, describe } from "@effect/vitest";

const MCP_TOOLS = [
  "open_session",
  "save_plan_version",
  "record_agent_action",
  "create_strategy_definition",
  "create_strategy_version",
  "create_candlestick_request",
  "create_dataset_snapshot",
  "start_backtest_run",
  "append_research_note",
  "get_run_summary",
] as const;

describe("MCP Tool Validation", () => {
  describe("Tool Existence", () => {
    it("open_session tool exports correctly", async () => {
      const { openSessionTool } = await import("../tools");
      expect(openSessionTool).toBeDefined();
    });

    it("start_backtest_run tool exports correctly", async () => {
      const { startBacktestRunTool } = await import("../tools");
      expect(startBacktestRunTool).toBeDefined();
    });

    it("get_run_summary tool exports correctly", async () => {
      const { getRunSummaryTool } = await import("../tools");
      expect(getRunSummaryTool).toBeDefined();
    });
  });

  describe("Tool Schema Validation", () => {
    it("open_session has required fields", async () => {
      const { openSessionTool } = await import("../tools");
      expect(openSessionTool.name).toBe("open_session");
      expect(openSessionTool.description).toBeTruthy();
      expect(openSessionTool.inputSchema).toBeDefined();
    });

    it("start_backtest_run has required fields", async () => {
      const { startBacktestRunTool } = await import("../tools");
      expect(startBacktestRunTool.name).toBe("start_backtest_run");
      expect(startBacktestRunTool.description).toBeTruthy();
      expect(startBacktestRunTool.inputSchema).toBeDefined();
    });
  });

  describe("Tool Naming Convention", () => {
    it("all tool names use snake_case", () => {
      const snakeCasePattern = /^[a-z]+(?:_[a-z]+)*$/;
      for (const toolName of MCP_TOOLS) {
        expect(toolName).toMatch(snakeCasePattern);
      }
    });
  });

  describe("Tool Input Contracts", () => {
    it("open_session input has source and objective", async () => {
      const { openSessionTool } = await import("../tools");
      const input = openSessionTool.inputSchema;
      expect(input).toHaveProperty("properties");
      expect(input.properties).toHaveProperty("source");
      expect(input.properties).toHaveProperty("objective");
    });

    it("start_backtest_run input has required strategy and snapshot ids", async () => {
      const { startBacktestRunTool } = await import("../tools");
      const input = startBacktestRunTool.inputSchema;
      expect(input).toHaveProperty("properties");
      expect(input.properties).toHaveProperty("strategy_version_id");
      expect(input.properties).toHaveProperty("dataset_snapshot_id");
    });
  });
});
