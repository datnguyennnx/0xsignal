import { it, expect, describe, vi } from "vitest";
import { Effect, Layer } from "effect";
import { makeBacktestService } from "../backtest";
import { EngineExecutor, type EngineOutput } from "@domain/backtest/engine";

describe("Backtest Execution Flow", () => {
  it("should trigger background worker and update row status when backtest is started", async () => {
    // We mock the repo dependencies to verify execution flow
    const mockRepo = {
      insertRun: vi.fn().mockImplementation((run) => Promise.resolve(run)),
      updateRunStatus: vi.fn().mockImplementation((_id, _status) => Promise.resolve()),
      insertEvent: vi.fn().mockImplementation((event) => Promise.resolve(event)),
      getRun: vi.fn().mockImplementation((id) =>
        Promise.resolve({
          id,
          initial_capital: 10000,
          base_currency: "USD",
          strategy_version_id: "strat-1",
          dataset_snapshot_id: "data-1",
        })
      ),
      insertMetric: vi.fn().mockImplementation((m) => Promise.resolve(m)),
      insertRunInput: vi.fn(),
      getRunInput: vi.fn(),
      getMetricsByRun: vi.fn(),
      getEventsByRun: vi.fn(),
      getEventCount: vi.fn(),
    };

    const TestEngine = Layer.succeed(
      EngineExecutor,
      EngineExecutor.of({
        runEngine: () =>
          Effect.succeed({
            status: "completed",
            metrics: {
              total_return: 1.5,
            },
            events: [
              {
                timestamp: new Date().toISOString(),
                event_type: "info",
                level: "info",
                payload: { message: "Stub engine finished" },
              },
            ],
            artifacts: [],
            run_duration_ms: 10,
            bars_processed: 1,
          } satisfies EngineOutput),
      })
    );

    const runId = "test-run-123";
    const effect = Effect.gen(function* () {
      const backtestService = yield* makeBacktestService(mockRepo);
      return yield* backtestService.createBacktestRun({
        id: runId,
        strategy_version_id: "strat-1",
        dataset_snapshot_id: "data-1",
        status: "pending",
        engine_version: "1.0",
        run_mode: "backtest",
        initial_capital: 10000,
        base_currency: "USD",
      });
    }).pipe(Effect.provide(TestEngine));

    await Effect.runPromise(effect);

    // Initial persistence check
    expect(mockRepo.insertRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: runId,
        status: "pending",
      })
    );

    // Wait briefly for background fork Daemon to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify background worker state transitions
    // First it transitions to "running"
    expect(mockRepo.updateRunStatus).toHaveBeenCalledWith(runId, "running");

    // Then it emits an entry event
    expect(mockRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        run_id: runId,
        payload: { message: "Starting backtest execution" },
      })
    );

    // Then it dumps completed metrics
    expect(mockRepo.insertMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        metric_key: "total_return",
        metric_value: 1.5,
      })
    );

    // End event
    expect(mockRepo.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          message: "Backtest completed with status: completed",
        }),
      })
    );

    // Final finish status
    expect(mockRepo.updateRunStatus).toHaveBeenCalledWith(runId, "completed");
  });
});
