import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import type { BacktestRun } from "../../../schemas/backtest";
import type { BacktestRepository } from "../../ports/backtest-repository";
import { executeBacktestRun } from "../execution";

const minimalRun: BacktestRun = {
  id: "run-1",
  strategy_version_id: "strat-v1",
  dataset_snapshot_id: "ds-1",
  status: "queued",
  engine_version: "1",
  run_mode: "backtest",
  initial_capital: 10_000,
  base_currency: "USD",
};

describe("executeBacktestRun", () => {
  it("runs engine, persists metrics and events, then completes", async () => {
    const updateRunStatus = vi.fn().mockResolvedValue(null);
    const insertEvent = vi.fn().mockResolvedValue({});
    const insertMetric = vi.fn().mockResolvedValue({});

    const repo: BacktestRepository = {
      createRunWithInput: vi.fn(),
      getRun: vi.fn(),
      getRunInput: vi.fn(),
      insertRunInput: vi.fn(),
      insertMetric,
      getMetricsByRun: vi.fn(),
      insertEvent,
      getEventsByRun: vi.fn(),
      getEventCount: vi.fn(),
      updateRunStatus,
    };

    const runEngine = vi.fn().mockReturnValue(
      Effect.succeed({
        status: "completed" as const,
        metrics: { sharpe: 1.2 },
        events: [
          {
            timestamp: new Date().toISOString(),
            event_type: "custom_event",
            payload: { x: 1 },
            level: "info" as const,
          },
        ],
        artifacts: [],
        run_duration_ms: 100,
        bars_processed: 50,
      })
    );

    await Effect.runPromise(executeBacktestRun(repo, { runEngine }, minimalRun));

    expect(updateRunStatus).toHaveBeenCalledWith("run-1", "running");
    expect(runEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy_snapshot: { id: "strat-v1" },
        dataset_snapshot_ref: { id: "ds-1" },
        schema_version: "1.0.0",
      })
    );
    expect(insertMetric).toHaveBeenCalledWith(
      expect.objectContaining({ run_id: "run-1", metric_key: "sharpe", metric_value: 1.2 })
    );
    expect(updateRunStatus).toHaveBeenCalledWith("run-1", "completed");
    expect(insertEvent.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("on failure marks run failed and records error event", async () => {
    const updateRunStatus = vi.fn().mockResolvedValue(null);
    const insertEvent = vi.fn().mockResolvedValue({});

    const repo: BacktestRepository = {
      createRunWithInput: vi.fn(),
      getRun: vi.fn(),
      getRunInput: vi.fn(),
      insertRunInput: vi.fn(),
      insertMetric: vi.fn(),
      getMetricsByRun: vi.fn(),
      insertEvent,
      getEventsByRun: vi.fn(),
      getEventCount: vi.fn(),
      updateRunStatus,
    };

    const runEngine = vi.fn().mockReturnValue(Effect.fail(new Error("engine boom")));

    await Effect.runPromise(executeBacktestRun(repo, { runEngine }, minimalRun));

    expect(updateRunStatus).toHaveBeenCalledWith("run-1", "failed");
    const errorCalls = insertEvent.mock.calls.filter((call) => call[0]?.event_type === "error");
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
    expect(errorCalls[0][0].payload).toMatchObject({
      message: "Backtest engine execution failed",
    });
  });
});
