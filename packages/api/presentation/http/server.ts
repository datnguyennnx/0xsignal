#!/usr/bin/env bun
/** HTTP Server - Bun-native with WebSocket support */

import { Effect, ManagedRuntime } from "effect";
import { BunRuntime } from "@effect/platform-bun";
import { AppLayer } from "@infrastructure/layers/app.layer";
import { handleRequest } from "./router";
import { runMigrations } from "@infrastructure/db/postgres/migrations/migration";

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
          } catch (error) {
            // Enhanced error logging
            console.error("[Request Error]:", error);

            const httpError = toHttpError(error);

            const message =
              httpError.message || (typeof error === "string" ? error : "Internal server error");
            const status = httpError.status ?? 500;

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

  // Keep the program alive until SIGTERM/SIGINT (handled by BunRuntime.runMain)
  yield* Effect.never;
});

// Run with Bun-optimized runtime
BunRuntime.runMain(serverProgram.pipe(Effect.provide(AppLayer), Effect.scoped));
