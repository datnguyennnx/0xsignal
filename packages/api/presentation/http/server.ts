import { Effect, ManagedRuntime } from "effect";
import { AppLayer } from "../../infrastructure/layers/app.layer";
import { handleRequest } from "./router";
import { type MarketWsConnectionData } from "../../infrastructure/streams/hyperliquid/hub";
import { MarketStreamHub, MarketStreamHubLayer } from "./ws/market-stream-hub.layer";
import { parseMarketWsSubscription } from "./ws/subscription-parser";
import { CORS_HEADERS, withCorsHeaders } from "./cors";
import { errorResponse } from "./error-response";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 9006;

// Create a managed runtime for bridging non-Effect code
// NOTE: AppLayer is NOT provided again below — ManagedRuntime.make already
// memoizes it. Providing AppLayer again via Effect.provide would create a
// second independent instance (duplicate pools, fibers, etc.).
const runtime = ManagedRuntime.make(AppLayer);

// App Program
const serverProgram = Effect.gen(function* () {
  const marketStreamHub = yield* MarketStreamHub;
  marketStreamHub.setRuntime(runtime);

  // Use Effect's acquireRelease for the server lifecycle
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
                  headers: { "Content-Type": "application/json", ...CORS_HEADERS },
                }
              );
            }

            const upgraded = server.upgrade(req, {
              data: marketStreamHub.createConnectionData(parsed.data),
            });

            if (upgraded) {
              return undefined;
            }

            return new Response(
              JSON.stringify({ error: "WebSocket upgrade failed", status: 400 }),
              {
                status: 400,
                headers: { "Content-Type": "application/json", ...CORS_HEADERS },
              }
            );
          }

          // CORS preflight
          if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
          }

          try {
            const response = await runtime.runPromise(
              Effect.gen(function* () {
                yield* Effect.logInfo(`${req.method} ${url.pathname}`);
                return yield* handleRequest(req);
              })
            );

            const headers = withCorsHeaders(new Headers(response.headers));

            return new Response(response.body, {
              status: response.status,
              headers,
            });
          } catch (error) {
            // Enhanced error logging
            console.error("[Request Error]:", error);
            return errorResponse(error);
          }
        },
        reusePort: true,
        idleTimeout: 30,
        websocket: {
          open(ws) {
            marketStreamHub.handleOpen(ws);
          },
          message(ws, message) {
            marketStreamHub.handleMessage(ws, message);
          },
          close(ws) {
            marketStreamHub.handleClose(ws);
          },
        },
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

  // Keep the program alive until SIGTERM/SIGINT
  yield* Effect.never;
});

// MarketStreamHubLayer is program-scoped, not part of AppLayer.
// Other deps (HyperliquidProvider, Postgres pool) come from the
// ManagedRuntime's single memoized AppLayer instance.

const abortController = new AbortController();

const shutdown = () => {
  abortController.abort();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

runtime
  .runPromise(serverProgram.pipe(Effect.provide(MarketStreamHubLayer), Effect.scoped), {
    signal: abortController.signal,
  })
  .then(() => {
    process.exit(0);
  })
  .catch((cause) => {
    // If we were shutting down, the interruption is expected
    if (abortController.signal.aborted) {
      process.exit(0);
    }
    console.error("Fatal error:", cause);
    process.exit(1);
  });
