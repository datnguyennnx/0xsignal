#!/usr/bin/env tsx
/**
 * HTTP Server
 * Effect-native server with built-in logging
 *
 * IMPORTANT: Uses ManagedRuntime to ensure services (and their caches) are
 * initialized once and reused across all requests.
 *
 * OPTIMIZATION: Pre-warms caches at startup for instant responses.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Effect, Layer, ManagedRuntime } from "effect";
import { AppLayer } from "../../infrastructure/layers/app.layer";
import { createWebSocketServer } from "../../infrastructure/streaming/websocket-server";
import { SubscriptionManagerLive } from "../../infrastructure/streaming/subscription-manager";
import { handleRequest } from "./router";
import { applyCors, handleOptionsRequest } from "./middleware/cors.middleware";
import { CoinGeckoService } from "../../infrastructure/data-sources/coingecko";
import { DefiLlamaService } from "../../infrastructure/data-sources/defillama";
import { HeatmapService } from "../../infrastructure/data-sources/heatmap";
import { AnalysisServiceTag } from "../../services/analysis";
import { BuybackServiceTag } from "../../services/buyback";
import { DEFAULT_LIMITS } from "../../infrastructure/config/app.config";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 9006;

// Create a managed runtime that initializes services ONCE and reuses them
const runtime = ManagedRuntime.make(AppLayer);

// Request handler using the shared runtime
const handleHttpRequest = (req: IncomingMessage, res: ServerResponse) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // Apply CORS headers
  applyCors(res, requestId);

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    handleOptionsRequest(res);
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const method = req.method || "GET";
  const path = url.pathname;

  res.setHeader("Content-Type", "application/json");

  // Build effect pipeline with logging
  const effect = Effect.gen(function* () {
    yield* Effect.logInfo(`→ ${method} ${path}`);
    return yield* handleRequest(url, method);
  });

  // Use the shared runtime - services and caches are reused!
  runtime
    .runPromise(effect as Effect.Effect<any, any, never>)
    .then((result) => {
      const duration = Date.now() - startTime;
      runtime.runFork(Effect.logInfo(`← 200 ${path} (${duration}ms)`));
      res.writeHead(200);
      res.end(JSON.stringify(result));
    })
    .catch((error: any) => {
      const duration = Date.now() - startTime;
      const status = error.status || 500;
      const errorMsg = error.message || "Internal server error";

      runtime.runFork(Effect.logError(`✗ ${status} ${path} (${duration}ms): ${errorMsg}`));

      res.writeHead(status);
      res.end(JSON.stringify({ error: errorMsg, requestId }));
    });
};

// Start server
const server = createServer(handleHttpRequest);

server.listen(PORT, () => {
  // Provide layers for WebSocket
  const subscriptionLayerWithDeps = SubscriptionManagerLive.pipe(Layer.provide(AppLayer));
  const wsLayerWithSubscriptions = Layer.merge(AppLayer, subscriptionLayerWithDeps);
  const wsRuntime = ManagedRuntime.make(wsLayerWithSubscriptions);

  const startupProgram = Effect.gen(function* () {
    yield* Effect.logInfo("0xSignal API Server");
    yield* Effect.logInfo(`Server:    http://localhost:${PORT}`);
    yield* Effect.logInfo(`Health:    http://localhost:${PORT}/api/health`);
    yield* Effect.logInfo(`WebSocket: ws://localhost:${PORT}/ws/chart`);

    // Initialize WebSocket server
    yield* Effect.logInfo("Initializing WebSocket server...");
    const wsServer = yield* createWebSocketServer(server);
    yield* Effect.logInfo("WebSocket server ready");

    // Pre-warm caches in background using the HTTP runtime (not wsRuntime!)
    // This ensures the same cache instances are warmed that HTTP requests will use
    yield* Effect.logInfo("Pre-warming caches...");
    runtime.runFork(
      Effect.gen(function* () {
        const coinGecko = yield* CoinGeckoService;
        const defiLlama = yield* DefiLlamaService;
        const heatmap = yield* HeatmapService;
        const analysis = yield* AnalysisServiceTag;
        const buyback = yield* BuybackServiceTag;

        // Warm all caches concurrently
        yield* Effect.all(
          [
            coinGecko.getTopCryptos(DEFAULT_LIMITS.TOP_CRYPTOS),
            coinGecko.getTopCryptos(DEFAULT_LIMITS.TOP_CRYPTOS_EXTENDED),
            defiLlama.getProtocolsWithRevenue(),
            heatmap.getMarketHeatmap({
              limit: DEFAULT_LIMITS.HEATMAP,
              sortBy: "marketCap",
              metric: "change24h",
            }),
            analysis.analyzeTopAssets(DEFAULT_LIMITS.ANALYSIS_ASSETS),
            buyback.getBuybackOverview(),
          ],
          { concurrency: "unbounded" }
        ).pipe(
          Effect.tap(() => Effect.logInfo("✓ All caches pre-warmed")),
          Effect.catchAll((e) => Effect.logWarning(`Cache pre-warm partial failure: ${e}`))
        );
      })
    );

    // Graceful shutdown
    process.on("SIGTERM", () => {
      wsRuntime
        .runPromise(
          Effect.gen(function* () {
            yield* Effect.logInfo("Received SIGTERM, shutting down gracefully...");
            yield* wsServer.shutdown;
            yield* Effect.sync(() => server.close());
          })
        )
        .then(() => runtime.dispose())
        .then(() => wsRuntime.dispose());
    });
  });

  wsRuntime.runPromise(startupProgram).catch((error) => {
    console.error("Startup error:", error);
  });
});
