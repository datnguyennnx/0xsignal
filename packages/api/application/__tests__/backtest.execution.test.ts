import { it, expect, describe, vi } from "vitest";
import { Effect, Layer } from "effect";
import { makeBacktestService } from "../backtest/service";
import { EngineExecutor, type EngineOutput } from "../../domain/backtest/engine";

describe("Backtest Execution Flow", () => {
  const eventually = async (assertFn: () => void, timeoutMs = 1000) => {
    const startedAt = Date.now();
    // Poll because engine execution runs in a detached fiber.
    for (;;) {
      try {
        assertFn();
        return;
      } catch (error) {
        if (Date.now() - startedAt >= timeoutMs) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  };

  it("should trigger background worker and update row status when backtest is started", async () => {
    // We mock the repo dependencies to verify execution flow
    const mockRepo = {
      insertRun: vi.fn().mockImplementation((run) => Effect.succeed(run)),
      createRunWithInput: vi.fn().mockImplementation((run) => Effect.succeed(run)),
      updateRunStatus: vi.fn().mockImplementation((_id, _status) => Effect.succeed(undefined)),
      insertEvent: vi.fn().mockImplementation((event) => Effect.succeed(event)),
      getRun: vi.fn().mockImplementation((id) =>
        Effect.succeed({
          id,
          initial_capital: 10000,
          base_currency: "USD",
          strategy_version_id: "strat-1",
          dataset_snapshot_id: "data-1",
        })
      ),
      insertMetric: vi.fn().mockImplementation((m) => Effect.succeed(m)),
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
        status: "queued",
        engine_version: "1.0",
        run_mode: "backtest",
        initial_capital: 10000,
        base_currency: "USD",
      });
    }).pipe(Effect.provide(TestEngine));

    await Effect.runPromise(effect);

    // Initial persistence check
    expect(mockRepo.createRunWithInput).toHaveBeenCalledWith(
      expect.objectContaining({
        id: runId,
        status: "queued",
      }),
      expect.objectContaining({
        run_id: runId,
      })
    );

    await eventually(() => {
      expect(mockRepo.updateRunStatus).toHaveBeenCalledWith(runId, "completed");
      expect(mockRepo.insertMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_key: "total_return",
          metric_value: 1.5,
        })
      );
      expect(mockRepo.insertEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            message: "Backtest completed with status: completed",
          }),
        })
      );
    });

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

    // Final async assertions are covered by waitFor above
  });
});
