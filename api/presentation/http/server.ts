#!/usr/bin/env tsx
import { createServer } from "node:http";
import { Effect, Layer } from "effect";
import { AppLayer } from "../../infrastructure/layers/app.layer";
import { Logger } from "../../infrastructure/logging/logger.service";
import { createWebSocketServer } from "../../infrastructure/streaming/websocket-server";
import { SubscriptionManagerLive } from "../../infrastructure/streaming/subscription-manager";
import { handleRequest } from "./router";
import { applyCors, handleOptionsRequest } from "./middleware/cors.middleware";
import { handleDocsRequest } from "./middleware/docs.middleware";
import { logRequest, logResponse, logError } from "./middleware/logger.middleware";

const PORT = 9006;

// Start server
const server = createServer((req, res) => {
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

  // Handle documentation routes
  if (handleDocsRequest(url.pathname, req, res)) {
    return;
  }

  const method = req.method || "GET";
  const path = url.pathname;

  res.setHeader("Content-Type", "application/json");

  // Build effect pipeline
  const effect = Effect.gen(function* () {
    const queryParams = Object.fromEntries(url.searchParams);
    yield* logRequest(method, path, queryParams, requestId);
    return yield* handleRequest(url, method);
  });

  const program = Effect.provide(effect as any, AppLayer) as Effect.Effect<any, any, never>;

  Effect.runPromise(program)
    .then((result) => {
      const duration = Date.now() - startTime;
      logResponse(path, duration, requestId);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    })
    .catch((error: any) => {
      const duration = Date.now() - startTime;
      const status = error.status || 500;
      const errorMsg = error.message || "Internal server error";

      logError(path, status, duration, errorMsg, requestId);

      res.writeHead(status);
      res.end(JSON.stringify({ error: errorMsg, requestId }));
    });
});

server.listen(PORT, () => {
  const startupProgram = Effect.gen(function* () {
    const logger = yield* Logger;

    yield* logger.info("0xSignal API Server");
    yield* logger.info(`Server:    http://localhost:${PORT}`);
    yield* logger.info(`Health:    http://localhost:${PORT}/api/health`);
    yield* logger.info(`API Docs:  http://localhost:${PORT}/api/docs`);
    yield* logger.info(`OpenAPI:   http://localhost:${PORT}/api/docs.json`);
    yield* logger.info(`WebSocket: ws://localhost:${PORT}/ws/chart`);

    // Initialize WebSocket server
    yield* logger.info("Initializing WebSocket server...");
    const wsServer = yield* createWebSocketServer(server);
    yield* logger.info("WebSocket server ready");

    // Graceful shutdown
    const handleShutdown = Effect.gen(function* () {
      yield* logger.info("Received SIGTERM, shutting down gracefully...");
      yield* wsServer.shutdown;
      yield* Effect.sync(() => server.close());
    });

    process.on("SIGTERM", () => {
      Effect.runPromise(
        Effect.provide(handleShutdown, wsLayerWithSubscriptions) as Effect.Effect<
          void,
          never,
          never
        >
      );
    });
  });

  // Provide Logger to SubscriptionManagerLive, then merge with AppLayer
  const subscriptionLayerWithDeps = SubscriptionManagerLive.pipe(Layer.provide(AppLayer));
  const wsLayerWithSubscriptions = Layer.merge(AppLayer, subscriptionLayerWithDeps);

  Effect.runPromise(
    Effect.provide(startupProgram, wsLayerWithSubscriptions) as Effect.Effect<void, never, never>
  ).catch((error) => {
    Effect.runFork(
      Effect.provide(
        Effect.gen(function* () {
          const logger = yield* Logger;
          yield* logger.error("WebSocket initialization error", { error: error.message });
        }),
        AppLayer
      ) as Effect.Effect<void, never, never>
    );
  });
});
