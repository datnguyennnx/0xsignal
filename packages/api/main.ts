import { Effect } from "effect";
import { make as makeRuntime } from "effect/ManagedRuntime";
import { MarketStreamHub } from "./modules/market-data";
import { appLayer, createWsSetup, routes } from "./app";
import { CorsService } from "./platform/http/cors";
import type { RunSocketWork } from "./platform/http/ws";
import { mapServiceError } from "./app/error-mapping";
import { serve } from "./platform/http/server";

const runtime = makeRuntime(appLayer);

// Bun socket callbacks run outside Effect; this is the one boundary that hands
// their work to the application runtime.
const runSocketWork: RunSocketWork = (effect, onError) => {
  void runtime.runPromise(effect).catch(onError);
};

const abortController = new AbortController();
const shutdown = () => {
  abortController.abort();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  const cors = await runtime.runPromise(
    Effect.gen(function* () {
      return yield* CorsService;
    }),
  );
  const marketStreamHub = await runtime.runPromise(
    Effect.gen(function* () {
      return yield* MarketStreamHub;
    }),
  );
  await serve(
    {
      runtime,
      routes,
      cors,
      ws: createWsSetup(marketStreamHub, runSocketWork),
      mapError: mapServiceError,
    },
    abortController.signal,
  );
} catch (cause) {
  if (abortController.signal.aborted) process.exit(0);
  console.error("Fatal error:", cause);
  process.exit(1);
}
