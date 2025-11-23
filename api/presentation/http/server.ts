#!/usr/bin/env tsx
import { createServer } from "node:http";
import { Effect, Layer } from "effect";
import { AppLayer } from "../../infrastructure/layers/app.layer";
import { Logger } from "../../infrastructure/logging/logger.service";
import { MarketAnalysisServiceTag } from "../../domain/services/market-analysis";
import { ChartDataServiceTag } from "../../domain/services/chart-data.service";
import { createWebSocketServer } from "../../infrastructure/streaming/websocket-server";
import { SubscriptionManagerLive } from "../../infrastructure/streaming/subscription-manager";

const PORT = 9006;

// Simple functional router using Effect
const handleRequest = (url: URL, method: string) => {
  const path = url.pathname;

  // Health check
  if (path === "/api/health") {
    return Effect.succeed({
      status: "ok",
      timestamp: new Date(),
      uptime: (globalThis as any).process?.uptime?.() || 0,
    });
  }

  // Top analysis (with enhanced quant data)
  if (path === "/api/analysis/top") {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    return Effect.gen(function* () {
      const service = yield* MarketAnalysisServiceTag;
      return yield* service.analyzeTopCryptos(limit);
    });
  }

  // Market overview
  if (path === "/api/overview") {
    return Effect.gen(function* () {
      const service = yield* MarketAnalysisServiceTag;
      return yield* service.getMarketOverview();
    });
  }

  // Trading signals (high confidence only)
  if (path === "/api/signals") {
    return Effect.gen(function* () {
      const service = yield* MarketAnalysisServiceTag;
      const analyses = yield* service.analyzeTopCryptos(50);
      // Return high confidence quant signals
      return analyses.filter((a: any) => a.quantAnalysis?.confidence >= 60);
    });
  }

  // High confidence signals endpoint
  if (path === "/api/signals/high-confidence") {
    const minConfidence = parseInt(url.searchParams.get("confidence") || "70");
    return Effect.gen(function* () {
      const service = yield* MarketAnalysisServiceTag;
      return yield* service.getHighConfidenceSignals(minConfidence);
    });
  }

  // Chart data endpoint
  if (path === "/api/chart") {
    const symbol = url.searchParams.get("symbol");
    const interval = url.searchParams.get("interval") || "1h";
    const timeframe = url.searchParams.get("timeframe") || "24h";

    if (!symbol) {
      return Effect.fail({ status: 400, message: "Symbol parameter is required" });
    }

    // Calculate limit based on timeframe and interval
    const limitMap: Record<string, Record<string, number>> = {
      "24h": { "1m": 1440, "5m": 288, "15m": 96, "30m": 48, "1h": 24 },
      "7d": { "15m": 672, "30m": 336, "1h": 168, "4h": 42 },
      "1M": { "1h": 720, "4h": 180, "1d": 30 },
      "1y": { "1d": 365, "1w": 52 },
    };

    const limit = limitMap[timeframe]?.[interval] || 100;

    return Effect.gen(function* () {
      const service = yield* ChartDataServiceTag;
      return yield* service.getHistoricalData(symbol.toUpperCase(), interval, limit);
    });
  }

  // Single symbol analysis
  if (path.startsWith("/api/analysis/")) {
    const symbol = path.split("/").pop();
    if (symbol && symbol !== "top") {
      return Effect.gen(function* () {
        const service = yield* MarketAnalysisServiceTag;
        return yield* service.analyzeSymbol(symbol);
      });
    }
  }

  // 404
  return Effect.fail({ status: 404, message: "Not found" });
};

// Start server
const server = createServer((req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Request-ID", requestId);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const method = req.method || "GET";
  const path = url.pathname;

  res.setHeader("Content-Type", "application/json");

  // Log incoming request
  const logRequest = Effect.gen(function* () {
    const logger = yield* Logger;
    const queryParams = Object.fromEntries(url.searchParams);
    const queryStr =
      Object.keys(queryParams).length > 0 ? `?${new URLSearchParams(queryParams).toString()}` : "";

    yield* logger.info(`→ ${method} ${path}${queryStr}`, { requestId });
  });

  const effect = Effect.gen(function* () {
    yield* logRequest;
    return yield* handleRequest(url, method);
  });

  const program = Effect.provide(effect as any, AppLayer) as Effect.Effect<any, any, never>;

  Effect.runPromise(program)
    .then((result) => {
      const duration = Date.now() - startTime;

      // Log successful response
      Effect.runFork(
        Effect.provide(
          Effect.gen(function* () {
            const logger = yield* Logger;
            yield* logger.info(`← 200 ${path} (${duration}ms)`, { requestId });
          }),
          AppLayer
        ) as Effect.Effect<void, never, never>
      );

      res.writeHead(200);
      res.end(JSON.stringify(result));
    })
    .catch((error: any) => {
      const duration = Date.now() - startTime;
      const status = error.status || 500;

      // Log error response
      Effect.runFork(
        Effect.provide(
          Effect.gen(function* () {
            const logger = yield* Logger;
            const errorMsg = error.message || "Internal server error";
            yield* logger.error(`← ${status} ${path} (${duration}ms) - ${errorMsg}`, { requestId });
          }),
          AppLayer
        ) as Effect.Effect<void, never, never>
      );

      res.writeHead(status);
      res.end(
        JSON.stringify({
          error: error.message || "Internal server error",
          requestId,
        })
      );
    });
});

server.listen(PORT, () => {
  const startupProgram = Effect.gen(function* () {
    const logger = yield* Logger;

    yield* logger.info("\n0xSignal API Server");
    yield* logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    yield* logger.info(`Server:   http://localhost:${PORT}`);
    yield* logger.info(`Health:   http://localhost:${PORT}/api/health`);
    yield* logger.info(`WebSocket: ws://localhost:${PORT}/ws/chart`);
    yield* logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

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

  const wsLayerWithSubscriptions = Layer.merge(AppLayer, SubscriptionManagerLive);

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
