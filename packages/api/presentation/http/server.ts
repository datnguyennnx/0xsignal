#!/usr/bin/env bun
/** HTTP Server - Bun-native with WebSocket support */

import { Effect, ManagedRuntime } from "effect";
import { BunRuntime } from "@effect/platform-bun";
import { AppLayer } from "../../infrastructure/layers/app.layer";
import { handleRequest } from "./router";
import { CoinGeckoService, GlobalMarketService } from "../../infrastructure/data-sources/coingecko";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 9006;

// Create a managed runtime for bridging non-Effect code
const runtime = ManagedRuntime.make(AppLayer);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Pre-warm caches
const prewarmAction = Effect.gen(function* () {
  const coinGecko = yield* CoinGeckoService;
  const globalMarket = yield* GlobalMarketService;

  yield* Effect.logInfo("Pre-warming essential caches...");

  // Sequence pre-warming with small delays to avoid 429 burst
  yield* coinGecko.getTopCryptos(250).pipe(
    Effect.tap(() => Effect.logInfo("Top cryptos (250) cache pre-warmed")),
    Effect.catchAll((e) => Effect.logWarning(`Top Cryptos pre-warm partial failure: ${e}`))
  );

  yield* Effect.sleep("2 seconds");

  yield* globalMarket.getGlobalMarket().pipe(
    Effect.tap(() => Effect.logInfo("Global market cache pre-warmed")),
    Effect.catchAll((e) => Effect.logWarning(`Global Market pre-warm partial failure: ${e}`))
  );

  yield* Effect.logInfo("Essential caches pre-warm complete");
});

// App Program
const serverProgram = Effect.gen(function* () {
  // Use Effect's acquireRelease for the server lifecycle
  yield* Effect.acquireRelease(
    Effect.sync(() =>
      Bun.serve({
        port: PORT,
        fetch: async (req) => {
          const url = new URL(req.url);

          // CORS preflight
          if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
          }

          try {
            const result = await runtime.runPromise(
              Effect.gen(function* () {
                yield* Effect.logInfo(`${req.method} ${url.pathname}`);
                return yield* handleRequest(url);
              })
            );
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          } catch (error: any) {
            // Enhanced error logging
            console.error("[Request Error]:", error);

            const message =
              error?.message || (typeof error === "string" ? error : "Internal server error");
            const status = error?.status || 500;

            return new Response(JSON.stringify({ error: message, status }), {
              status,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
        },
        reusePort: true,
        idleTimeout: 30,
      })
    ),
    (s) =>
      Effect.sync(() => {
        console.log("Shutting down server...");
        s.stop();
      })
  );

  console.log(`0xSignal API Server`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);

  // Run pre-warm in background
  yield* Effect.fork(prewarmAction);

  // Keep the program alive until SIGTERM/SIGINT (handled by BunRuntime.runMain)
  yield* Effect.never;
});

// Run with Bun-optimized runtime
BunRuntime.runMain(serverProgram.pipe(Effect.provide(AppLayer), Effect.scoped) as any);
