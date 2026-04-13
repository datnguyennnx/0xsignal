import { Effect, Layer } from "effect";
import { EngineExecutor, EngineOutput } from "@domain/backtest/engine";

export const StubEngineExecutor = Layer.succeed(
  EngineExecutor,
  EngineExecutor.of({
    runEngine: (input) =>
      Effect.gen(function* () {
        yield* Effect.logInfo(`Executing stub engine for strategy ${input.strategy_snapshot.id}`);
        yield* Effect.sleep("500 millis");

        const output: EngineOutput = {
          status: "completed",
          metrics: {
            total_return: 1.5,
            total_trades: 10,
            run_duration_ms: 500,
            bars_processed: 1000,
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
          run_duration_ms: 500,
          bars_processed: 1000,
        };

        return output;
      }),
  })
);
