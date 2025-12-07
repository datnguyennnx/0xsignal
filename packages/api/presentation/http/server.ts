#!/usr/bin/env bun
/** HTTP Server - Effect-native using Bun with functional patterns */

import { Effect, ManagedRuntime, Match } from "effect";
import { AppLayer } from "../../infrastructure/layers/app.layer";
import { handleRequest } from "./router";
import { CoinGeckoService } from "../../infrastructure/data-sources/coingecko";
import { DefiLlamaService } from "../../infrastructure/data-sources/defillama";
import { HeatmapService } from "../../infrastructure/data-sources/heatmap";
import { AnalysisServiceTag } from "../../services/analysis";
import { BuybackServiceTag } from "../../services/buyback";
import { DEFAULT_LIMITS } from "../../infrastructure/config/app.config";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 9006;

const runtime = ManagedRuntime.make(AppLayer);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Pre-warm caches
const prewarmCaches = Effect.gen(function* () {
  yield* Effect.logInfo("Pre-warming essential caches...");
  const { coinGecko, defiLlama, heatmap } = yield* Effect.all({
    coinGecko: CoinGeckoService,
    defiLlama: DefiLlamaService,
    heatmap: HeatmapService,
  });

  yield* Effect.all(
    {
      top20: coinGecko.getTopCryptos(20),
      protocols: defiLlama.getProtocolsWithRevenue(),
      heatmapData: heatmap.getMarketHeatmap({
        limit: DEFAULT_LIMITS.HEATMAP,
        sortBy: "marketCap",
        metric: "change24h",
      }),
    },
    { concurrency: "unbounded" }
  ).pipe(
    Effect.tap(() => Effect.logInfo("Essential caches pre-warmed")),
    Effect.catchAll((e) => Effect.logWarning(`Cache pre-warm partial failure: ${e}`))
  );
});

// Response builder using Match
const buildResponse = Match.type<{ success: boolean; data?: unknown; error?: any }>().pipe(
  Match.when(
    { success: true },
    ({ data }) =>
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
  ),
  Match.when(
    { success: false },
    ({ error }) =>
      new Response(JSON.stringify({ error: error?.message || "Internal server error" }), {
        status: error?.status || 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
  ),
  Match.exhaustive
);

// Handle OPTIONS request
const handleOptions = () => new Response(null, { status: 204, headers: corsHeaders });

// Handle API request
const handleApiRequest = async (url: URL, method: string) => {
  try {
    const result = await runtime.runPromise(
      Effect.gen(function* () {
        yield* Effect.logInfo(`${method} ${url.pathname}`);
        return yield* handleRequest(url, method);
      })
    );
    return buildResponse({ success: true, data: result });
  } catch (error: any) {
    return buildResponse({ success: false, error });
  }
};

// Request handler using Match
const handleFetch = (req: Request): Promise<Response> | Response => {
  const url = new URL(req.url);
  return Match.value(req.method).pipe(
    Match.when("OPTIONS", () => handleOptions()),
    Match.orElse(() => handleApiRequest(url, req.method))
  );
};

// Bun server
const server = Bun.serve({
  port: PORT,
  fetch: handleFetch,
  reusePort: true,
});

console.log(`0xSignal API Server`);
console.log(`Server: http://localhost:${PORT}`);
console.log(`Health: http://localhost:${PORT}/api/health`);

runtime.runFork(prewarmCaches);

process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  server.stop();
  await runtime.dispose();
  process.exit(0);
});
