#!/usr/bin/env bun
/** HTTP Server - Bun-native with WebSocket support */

import { Effect, ManagedRuntime } from "effect";
import { BunRuntime } from "@effect/platform-bun";
import { AppLayer } from "@infrastructure/layers/app.layer";
import { handleRequest } from "./router";
import { runMigrations } from "@infrastructure/db/postgres/migrations/migration";
import { type MarketWsConnectionData, parseMarketWsSubscription } from "./market-stream";
import { MarketStreamHub, MarketStreamHubLayer } from "./market-stream.layer";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 9006;

// Create a managed runtime for bridging non-Effect code
const runtime = ManagedRuntime.make(AppLayer);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type HttpError = {
  readonly message?: string;
  readonly status?: number;
};

const toHttpError = (error: unknown): HttpError =>
  typeof error === "object" && error !== null ? (error as HttpError) : {};

const extractErrorMessage = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed) as { message?: unknown };
        if (typeof parsed.message === "string") {
          return parsed.message;
        }
      } catch {
        return value;
      }
    }

    return value;
  }

  if (typeof value === "object" && value !== null) {
    const candidate = value as { message?: unknown };
    if (typeof candidate.message === "string") {
      return extractErrorMessage(candidate.message);
    }
  }

  return undefined;
};

// Run migrations on startup
const migrateAction = Effect.tryPromise({
  try: async () => {
    console.log("Running database migrations...");
    await runMigrations();
    console.log("Migrations complete");
  },
  catch: (error) => {
    console.error("Migration failed:", error);
    return error;
  },
});

// App Program
const serverProgram = Effect.gen(function* () {
  yield* migrateAction;
  const marketStreamHub = yield* MarketStreamHub;

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
                  headers: { "Content-Type": "application/json", ...corsHeaders },
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
                headers: { "Content-Type": "application/json", ...corsHeaders },
              }
            );
          }

          // CORS preflight
          if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
          }

          try {
            const response = await runtime.runPromise(
              Effect.gen(function* () {
                yield* Effect.logInfo(`${req.method} ${url.pathname}`);
                return yield* handleRequest(req);
              })
            );

            const headers = new Headers(response.headers);
            for (const [key, value] of Object.entries(corsHeaders)) {
              headers.set(key, value);
            }

            return new Response(response.body, {
              status: response.status,
              headers,
            });
          } catch (error) {
            // Enhanced error logging
            console.error("[Request Error]:", error);

            const httpError = toHttpError(error);

            const message =
              extractErrorMessage(httpError.message) ||
              extractErrorMessage(error) ||
              "Internal server error";
            const status = httpError.status ?? 500;

            return new Response(JSON.stringify({ error: message, status }), {
              status,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
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

  // Keep the program alive until SIGTERM/SIGINT (handled by BunRuntime.runMain)
  yield* Effect.never;
});

// Run with Bun-optimized runtime
BunRuntime.runMain(serverProgram.pipe(Effect.provide(MarketStreamHubLayer), Effect.scoped));
