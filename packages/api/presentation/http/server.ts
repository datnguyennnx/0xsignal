import { Config, Effect } from "effect";
import { make as makeRuntime } from "effect/ManagedRuntime";

import { AppLayer } from "../../infrastructure/layers/app.layer";
import { handleRequest } from "./router";
import { type MarketWsConnectionData } from "../../infrastructure/streams/hyperliquid/hub";
import { MarketStreamHub, MarketStreamHubLayer } from "./ws/market-stream-hub.layer";
import { parseMarketWsSubscription } from "./ws/subscription-parser";
import { CorsService } from "./cors";
import { errorResponse } from "./error-response";

const runtime = makeRuntime(AppLayer);

const serverProgram = Effect.gen(function* () {
  const PORT = yield* Config.int("PORT").pipe(Config.withDefault(9006));
  const marketStreamHub = yield* MarketStreamHub;

  const cors = yield* CorsService;
  const corsHeaders = cors.headers;
  const applyCors = cors.applyTo;
  const corsPreflight = cors.preflight;

  yield* Effect.acquireRelease(
    Effect.sync(() =>
      Bun.serve<MarketWsConnectionData>({
        port: PORT,
        fetch: async (req, server) => {
          const url = new URL(req.url);

          if (url.pathname === "/api/ws/market") {
            const parsed = parseMarketWsSubscription(url.searchParams);
            if (!parsed.ok) {
              return new Response(
                JSON.stringify({ error: parsed.message, status: parsed.status }),
                {
                  status: parsed.status,
                  headers: { "Content-Type": "application/json", ...corsHeaders },
                }
              );
            }

            const upgraded = server.upgrade(req, {
              data: marketStreamHub.createConnectionData(parsed.data),
            });

            if (upgraded) return undefined;

            return new Response(
              JSON.stringify({ error: "WebSocket upgrade failed", status: 400 }),
              {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              }
            );
          }

          if (req.method === "OPTIONS") return corsPreflight;

          try {
            const response = await runtime.runPromise(
              Effect.gen(function* () {
                yield* Effect.logInfo(`${req.method} ${url.pathname}`);
                return yield* handleRequest(req);
              })
            );

            const headers = applyCors(new Headers(response.headers));
            return new Response(response.body, { status: response.status, headers });
          } catch (error) {
            console.error("[Request Error]:", error);
            return errorResponse(error, corsHeaders);
          }
        },
        reusePort: true,
        idleTimeout: 30,
        websocket: {
          open(ws) {
            Effect.runPromise(marketStreamHub.handleOpen(ws)).catch((err) => {
              console.error("[WS Open Error]:", err);
            });
          },
          message(ws, message) {
            Effect.runPromise(marketStreamHub.handleMessage(ws, message)).catch((err) => {
              console.error("[WS Message Error]:", err);
            });
          },
          close(ws) {
            Effect.runPromise(marketStreamHub.handleClose(ws)).catch((err) => {
              console.error("[WS Close Error]:", err);
            });
          },
        },
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
  .runPromise(serverProgram.pipe(Effect.provide(MarketStreamHubLayer), Effect.scoped), {
    signal: abortController.signal,
  })
  .then(() => process.exit(0))
  .catch((cause: unknown) => {
    if (abortController.signal.aborted) process.exit(0);
    console.error("Fatal error:", cause);
    process.exit(1);
  });
