#!/usr/bin/env tsx
import { createServer } from "node:http";
import { Effect } from "effect";
import { AppLayer } from "../../infrastructure/layers/app.layer";
import { Logger } from "../../infrastructure/logging/logger.service";
import { MarketAnalysisServiceTag } from "../../domain/services/market-analysis";

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
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "20"),
      100
    );
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
      // Return signals with bubble signals OR high confidence quant signals
      return analyses.filter((a: any) => 
        a.bubbleAnalysis?.signals?.length > 0 || 
        (a.quantAnalysis?.confidence >= 60)
      );
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
    const queryStr = Object.keys(queryParams).length > 0 
      ? `?${new URLSearchParams(queryParams).toString()}` 
      : "";
    
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
      const logResponse = Effect.gen(function* () {
        const logger = yield* Logger;
        yield* logger.info(`← 200 ${path} (${duration}ms)`, { requestId });
      });
      
      Effect.runPromise(Effect.provide(logResponse, AppLayer));
      
      res.writeHead(200);
      res.end(JSON.stringify(result));
    })
    .catch((error: any) => {
      const duration = Date.now() - startTime;
      const status = error.status || 500;
      
      // Log error response
      const logError = Effect.gen(function* () {
        const logger = yield* Logger;
        const errorMsg = error.message || "Internal server error";
        yield* logger.error(`← ${status} ${path} (${duration}ms) - ${errorMsg}`, { requestId });
      });
      
      Effect.runPromise(Effect.provide(logError, AppLayer));
      
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
  console.log(`\n0xSignal API Server`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Server:   http://localhost:${PORT}`);
  console.log(`Health:   http://localhost:${PORT}/api/health`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
