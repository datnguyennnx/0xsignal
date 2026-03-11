/** AI WebSocket - Bun-native WebSocket handler for AI streaming */

import { Effect, Stream, Option, ManagedRuntime } from "effect";
import { AIServiceTag } from "../../services/ai";
import type { ChartContext, AIChunk } from "../../services/ai-types";

// Data attached to each WebSocket connection
export interface AIWSData {
  readonly id: string;
  readonly connectedAt: number;
}

// Client request message
interface AIStreamRequest {
  readonly type: "start_analysis";
  readonly symbol: string;
  readonly timeframe: string;
  readonly priceData: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  readonly currentPrice: number;
  readonly model?: {
    provider: "openai" | "anthropic" | "google";
    modelId: string;
  };
}

// Parse and validate incoming message
const parseStreamRequest = (raw: string): Option.Option<AIStreamRequest> => {
  try {
    const msg = JSON.parse(raw);
    if (
      msg.type === "start_analysis" &&
      typeof msg.symbol === "string" &&
      typeof msg.timeframe === "string" &&
      Array.isArray(msg.priceData) &&
      typeof msg.currentPrice === "number"
    ) {
      return Option.some(msg as AIStreamRequest);
    }
    return Option.none();
  } catch {
    return Option.none();
  }
};

// Safe send helper for Bun ServerWebSocket
const sendJson = (
  ws: { send: (data: string) => void; readyState: number },
  data: unknown
): void => {
  try {
    ws.send(JSON.stringify(data));
  } catch {
    // Client may have disconnected
  }
};

/**
 * Create Bun-native WebSocket handlers for AI streaming.
 * Usage in Bun.serve():
 *   const aiWs = createAIWebSocketHandlers(runtime);
 *   Bun.serve({
 *     fetch(req, server) {
 *       if (aiWs.shouldUpgrade(req)) return aiWs.upgrade(req, server);
 *       ...
 *     },
 *     websocket: aiWs.websocket,
 *   });
 */
export const createAIWebSocketHandlers = (runtime: ManagedRuntime.ManagedRuntime<any, any>) => {
  // Track connected clients
  let clientCount = 0;

  return {
    /** Check if request should be upgraded to WebSocket */
    shouldUpgrade: (req: Request): boolean => {
      const url = new URL(req.url);
      return url.pathname === "/ws/ai";
    },

    /** Upgrade request to WebSocket (call from fetch handler) */
    upgrade: (
      req: Request,
      server: { upgrade: (req: Request, opts?: any) => boolean }
    ): Response | undefined => {
      const success = server.upgrade(req, {
        data: {
          id: crypto.randomUUID(),
          connectedAt: Date.now(),
        } satisfies AIWSData,
      });

      if (success) return undefined; // Bun handles the response
      return new Response("WebSocket upgrade failed", { status: 500 });
    },

    /** Bun WebSocket handler object */
    websocket: {
      open(ws: { data: AIWSData; send: (data: string) => void; readyState: number }) {
        clientCount++;
        console.log(`[AI WS] Client connected: ${ws.data.id} (total: ${clientCount})`);
        sendJson(ws, { type: "connected", clientId: ws.data.id, timestamp: Date.now() });
      },

      async message(
        ws: { data: AIWSData; send: (data: string) => void; readyState: number },
        message: string | Buffer
      ) {
        const raw = typeof message === "string" ? message : message.toString();

        // Handle ping
        try {
          const parsed = JSON.parse(raw);
          if (parsed.type === "ping") {
            sendJson(ws, { type: "pong", timestamp: Date.now() });
            return;
          }
        } catch {
          // Fall through to parse as stream request
        }

        const request = parseStreamRequest(raw);

        if (Option.isNone(request)) {
          sendJson(ws, {
            type: "error",
            content:
              "Invalid request format. Expected: { type: 'start_analysis', symbol, timeframe, priceData, currentPrice }",
            timestamp: Date.now(),
          });
          return;
        }

        const req = request.value;

        // Send acknowledgment
        sendJson(ws, {
          type: "started",
          symbol: req.symbol,
          timestamp: Date.now(),
        });

        // Build chart context
        const context: ChartContext = {
          symbol: req.symbol,
          timeframe: req.timeframe,
          priceData: req.priceData,
          currentPrice: req.currentPrice,
        };

        // Run AI streaming via Effect runtime
        const program = Effect.gen(function* () {
          const aiService = yield* AIServiceTag;

          yield* Effect.logInfo(`[AI WS] Streaming analysis for ${req.symbol} (${req.timeframe})`);

          const stream = aiService.streamAnalysis(context, req.model);

          yield* Stream.runForEach(stream, (chunk: AIChunk) =>
            Effect.sync(() => {
              sendJson(ws, {
                type: chunk.type,
                content: chunk.content,
                timestamp: Date.now(),
              });
            })
          );

          // Send completion
          sendJson(ws, { type: "complete", timestamp: Date.now() });

          yield* Effect.logInfo(`[AI WS] Stream complete for ${req.symbol}`);
        }).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => {
              sendJson(ws, {
                type: "error",
                content: error instanceof Error ? error.message : "AI analysis failed",
                timestamp: Date.now(),
              });
            })
          )
        );

        await runtime.runPromise(program);
      },

      close(ws: { data: AIWSData }) {
        clientCount--;
        console.log(`[AI WS] Client disconnected: ${ws.data.id} (total: ${clientCount})`);
      },

      error(ws: { data: AIWSData }, error: Error) {
        console.error(`[AI WS] Error for ${ws.data.id}:`, error.message);
      },
    },

    /** Get count of connected clients */
    getConnectedClients: () => clientCount,
  };
};
