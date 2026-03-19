#!/usr/bin/env bun
/** HTTP Server - Bun-native with WebSocket support */

import { Effect, ManagedRuntime } from "effect";
import { AppLayer } from "../../infrastructure/layers/app.layer";
import { handleRequest } from "./router";
import { CoinGeckoService } from "../../infrastructure/data-sources/coingecko";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 9006;

const runtime = ManagedRuntime.make(AppLayer);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Pre-warm caches
const prewarmCaches = Effect.gen(function* () {
  yield* Effect.logInfo("Pre-warming essential caches...");
  const coinGecko = yield* CoinGeckoService;

  yield* Effect.all(
    {
      top20: coinGecko.getTopCryptos(20),
    },
    { concurrency: "unbounded" }
  ).pipe(
    Effect.tap(() => Effect.logInfo("Essential caches pre-warmed")),
    Effect.catchAll((e) => Effect.logWarning(`Cache pre-warm partial failure: ${e}`))
  );
});

// Parse request body for POST requests
const parseBody = async (req: Request): Promise<unknown> => {
  try {
    const contentType = req.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await req.json();
    }
    return undefined;
  } catch {
    return undefined;
  }
};

// Handle API request
const handleApiRequest = async (url: URL, _method: string, _body?: unknown) => {
  try {
    const result = await runtime.runPromise(
      Effect.gen(function* () {
        yield* Effect.logInfo(`${_method} ${url.pathname}`);
        return yield* handleRequest(url);
      })
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Internal server error" }), {
      status: error?.status || 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

// Bun server with native WebSocket support
const server = Bun.serve({
  port: PORT,
  fetch: async (req, _server) => {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // POST with body
    if (req.method === "POST") {
      const body = await parseBody(req);
      return handleApiRequest(url, req.method, body);
    }

    return handleApiRequest(url, req.method);
  },

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
