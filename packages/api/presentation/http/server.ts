import { Config, Effect } from "effect";
import { make as makeRuntime } from "effect/ManagedRuntime";
import { AppLayer } from "../../infrastructure/layers/app.layer";
import {
  MarketStreamHub,
  type MarketWsConnectionData,
} from "../../infrastructure/streams/hyperliquid/hub";
import { CorsService } from "./cors";
import { createFetchHandler } from "./fetch-handler";
import { createWsEventHandlers } from "./ws/event-handlers";

// Single runtime instance — all handlers share the same AppLayer
const runtime = makeRuntime(AppLayer);

const serverProgram = Effect.gen(function* () {
  const PORT = yield* Config.int("PORT").pipe(Config.withDefault(9006));
  const cors = yield* CorsService;
  const marketStreamHub = yield* MarketStreamHub;

  const fetchHandler = createFetchHandler(runtime, cors, marketStreamHub);
  const wsHandlers = createWsEventHandlers(marketStreamHub);

  yield* Effect.acquireRelease(
    Effect.sync(() =>
      Bun.serve<MarketWsConnectionData>({
        port: PORT,
        fetch: fetchHandler,
        websocket: wsHandlers,
        reusePort: true,
        idleTimeout: 30,
      })
    ),
    (s) =>
      Effect.gen(function* () {
        yield* Effect.logInfo("Shutting down server...");
        yield* Effect.sync(() => s.stop());
      })
  );

  yield* Effect.logInfo(`0xSignal API Server`);
  yield* Effect.logInfo(`Server: http://localhost:${PORT}`);
  yield* Effect.logInfo(`Health: http://localhost:${PORT}/api/health`);

  yield* Effect.never;
});

const abortController = new AbortController();
const shutdown = () => abortController.abort();
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

runtime
  .runPromise(serverProgram.pipe(Effect.scoped), {
    signal: abortController.signal,
  })
  .catch((cause: unknown) => {
    if (abortController.signal.aborted) process.exit(0);
    console.error("Fatal error:", cause);
    process.exit(1);
  });
